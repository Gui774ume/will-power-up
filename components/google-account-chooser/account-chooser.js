import { WillPowerUpGoogleOAuthClientID } from "../../constants.js";
import { CALENDAR_DOC, getGoogleAccountToken, PEOPLE_DOC } from "./account-helper.js";
import { prepareSearchContacts } from "../contacts/contacts.js";
import {
    toggleCalendarEventMeeting,
    chooseCalendarAndCreateEvent,
    chooseCalendarAndStarrCalendar,
    chooseCalendarAndSyncCalendarList,
    createCalendarEvent,
    patchCalendarEvent,
    prepareDeleteCalendarEvent,
    prepareFetchCardSyncedCalendarsFromAttachments,
    preparePullCalendarEventData,
    prepareSyncCalendarList,
    updateCalendarEventResponse,
} from "../calendar/calendar.js";

// googleScopes define the scopes required for the Power-Up
const googleScopes = 'https://www.googleapis.com/auth/calendar ' +
    'https://www.googleapis.com/auth/calendar.events ' +
    'https://www.googleapis.com/auth/userinfo.profile ' +
    'https://www.googleapis.com/auth/userinfo.email ' +
    'https://www.googleapis.com/auth/contacts ' +
    'https://www.googleapis.com/auth/contacts.readonly ' +
    'https://www.googleapis.com/auth/user.phonenumbers.read ' +
    'https://www.googleapis.com/auth/user.organization.read ' +
    'https://www.googleapis.com/auth/user.gender.read ' +
    'https://www.googleapis.com/auth/user.emails.read ' +
    'https://www.googleapis.com/auth/user.birthday.read ' +
    'https://www.googleapis.com/auth/user.addresses.read ' +
    'https://www.googleapis.com/auth/directory.readonly ' +
    'https://www.googleapis.com/auth/profile.agerange.read ' +
    'https://www.googleapis.com/auth/profile.emails.read ' +
    'https://www.googleapis.com/auth/profile.language.read';

let addGoogleAccount = document.getElementById('add_google_account');
let accountList = document.getElementById('account_list');
let t = TrelloPowerUp.iframe();
let trelloReady = false;
let tokenClient;

// Google Identity services
let googleISReady = false;
let googleISScript = document.createElement('script');
googleISScript.src = 'https://accounts.google.com/gsi/client';
googleISScript.onload = function() {
    tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: WillPowerUpGoogleOAuthClientID,
        scope: googleScopes,
        callback: handleAuthResponse,
    });
    googleISReady = true;
    maybeEnableButton();
};
document.body.appendChild(googleISScript);

// Google API service
let googleAPIReady = false;
let googleAPIInitialized = false;
let googleAPIScript = document.createElement('script');
googleAPIScript.src = 'https://apis.google.com/js/api.js';
googleAPIScript.onload = function() {
    gapi.load('client', async function() {
        googleAPIReady = true;
        maybeInitializeGoogleAPIClient();
    });
};
document.body.appendChild(googleAPIScript);

let maybeEnableButton = function() {
    if (googleISReady && trelloReady && googleAPIReady) {
        addGoogleAccount.disabled = false;
    }
}

let maybeInitializeGoogleAPIClient = function() {
    if (googleAPIReady && trelloReady && !googleAPIInitialized) {
        return t.get('board', 'shared', 'google_api_key')
            .then(async function(key) {
                await gapi.client.init({
                    apiKey: key,
                    discoveryDocs: [PEOPLE_DOC, CALENDAR_DOC],
                });
                googleAPIInitialized = true;
                maybeEnableButton();
            });
    }
}

let generateGoogleAccountEntry = function(newAccount) {
    // <div class="account-elem">
    //     <div>
    //         <img class="account-icon" src="https://trello-members.s3.amazonaws.com/63637a4a19d3ab0274662fc1/fcd5f66926b503d050814724cda6cb7a/170.png">
    //     </div>
    //     <div>
    //         <b>gui77aume.fournier@gmail.com</b>
    //         <br>
    //         <em>Guillaume Fournier</em>
    //     </div>
    // </div>
    let accountEntry = document.createElement('div');
    accountEntry.classList.add('account-elem');
    accountEntry.addEventListener('click', function(evt) {
        getGoogleAccountToken(t, newAccount.email)
            .then(function (token) {
                if (token == null) {
                    tokenClient.requestAccessToken({prompt: 'none', hint: newAccount.email});
                } else {
                    triggerCallback(t, newAccount.email);
                }
            });
    });
    let imgWrapper = document.createElement('div');
    let img = document.createElement('img');
    img.classList.add('account-icon');
    if (newAccount.photo !== undefined && newAccount.photo !== '') {
        img.src = newAccount.photo;
    }
    imgWrapper.appendChild(img);
    accountEntry.appendChild(imgWrapper);

    let metadataWrapper = document.createElement('div');
    let email = document.createElement('b');
    email.innerText = newAccount.email;
    let newLine = document.createElement('br');
    let name = document.createElement('em');
    name.innerText = newAccount.name;
    metadataWrapper.appendChild(email);
    metadataWrapper.appendChild(newLine);
    metadataWrapper.appendChild(name);
    accountEntry.appendChild(metadataWrapper);
    return accountEntry;
}

t.render(function() {
    trelloReady = true;
    maybeInitializeGoogleAPIClient();

    // load accounts
    t.get('board', 'private', 'google_accounts')
        .then(async function(accounts) {
            if (accounts === undefined || accounts.length === 0) {
                t.sizeTo("#account_chooser_wrapper").catch(function() {});
                return;
            }
            accountList.innerHTML = '';

            // check if a hint was provided and if we should follow it
            let hint = t.arg('emailHint');
            if (hint === undefined) {
                hint = '';
            }
            if (hint !== '') {
                let found = false;
                accounts.forEach(function(email) {
                    if (email === hint) {
                        found = true;
                    }
                });
                if (!found) {
                    hint = '';
                } else {
                    if (addGoogleAccount !== null && addGoogleAccount.parentNode !== null) {
                        // remove addGoogleAccount button
                        addGoogleAccount.parentNode.removeChild(addGoogleAccount);
                    }
                }
            }

            for (const email of accounts) {
                if (hint === '' || hint === email) {
                    await t.get('board', 'private', email)
                        .then(function (account) {
                            let node = generateGoogleAccountEntry(account);
                            accountList.appendChild(node);
                        });
                }
            }

            t.sizeTo("#account_chooser_wrapper")
                .catch(function(e) {});
        });
});

addGoogleAccount.addEventListener('click', function() {
    tokenClient.requestAccessToken({prompt: 'consent'});
});

let handleAuthResponse = async function(token) {
    // check if an error occured
    if (token.error !== undefined) {
        return t.alert({
            message: `Failed to add or update Google Account: ${token.error}`,
            duration: 10,
        });
    }

    // use the provided token
    gapi.client.setToken(token);

    // request email, name and photo details
    let userDetails = await gapi.client.people.people.get({
        'resourceName': 'people/me',
        'personFields': 'emailAddresses,names,photos,organizations',
    })

    // create empty account object to store the new token
    let newAccount = {
        token: token,
        tokenExpiresAt: (new Date()).setSeconds(new Date().getSeconds()+token.expires_in),
        email: "",
        name: "",
        photo: "",
        organizations: userDetails.result.organizations,
    };

    // data sanity check
    if (userDetails.result.emailAddresses === undefined || userDetails.result.emailAddresses.length === 0) {
        return t.alert({
            message: `Failed to add or update Google Account: no email address found`,
            duration: 10,
        });
    } else {
        newAccount.email = userDetails.result.emailAddresses[0].value;
    }
    if (userDetails.result.names === undefined || userDetails.result.names.length === 0) {
        return t.alert({
            message: `Failed to add or update Google Account: no name found`,
            duration: 10,
        });
    } else {
        newAccount.name = userDetails.result.names[0].displayName;
    }
    if (userDetails.result.photos !== undefined && userDetails.result.photos.length > 0) {
        newAccount.photo = userDetails.result.photos[0].url;
    }

    // store new account token
    t.get('board', 'private', 'google_accounts')
        .then(function(googleAccounts) {
            t.set('board', 'private', newAccount.email, newAccount)
                .then(function() {
                    if (googleAccounts === undefined) {
                        googleAccounts = [];
                    }
                    let found = false;
                    googleAccounts.forEach(function(elem) {
                        if (elem === newAccount.email) {
                            found = true;
                        }
                    });
                    if (!found) {
                        googleAccounts.push(newAccount.email);
                        t.set('board', 'private', 'google_accounts', googleAccounts)
                            .then(function() {
                                triggerCallback(t, newAccount.email);
                            });
                    } else {
                        triggerCallback(t, newAccount.email);
                    }
                })
        });
}

let triggerCallback = function(t, selectedEmail) {
    let callback = t.arg('callback');
    if (callback === undefined) {
        return;
    }

    switch (callback) {
        case "choose_calendar_and_create_event":
            chooseCalendarAndCreateEvent(t, selectedEmail);
            break;
        case "choose_calendar_and_sync_calendar_list":
            chooseCalendarAndSyncCalendarList(t, selectedEmail);
            break;
        case "choose_calendar_and_starr_calendar":
            chooseCalendarAndStarrCalendar(t, selectedEmail);
            break;
        case "delete_calendar_event":
            prepareDeleteCalendarEvent(t, t.arg('syncedCalendar'))
                .then(function() {
                    return t.popup({
                        title: `Sync with Google Calendar`,
                        url: '../calendar/calendar-form.html',
                        height: 120,
                    });
                });
            break;
        case "toggle_calendar_event_meeting":
            toggleCalendarEventMeeting(t, t.arg('syncedCalendar'), t.arg('shouldAdd'))
                .then(function() {
                    return t.popup({
                        title: `Sync with Google Calendar`,
                        url: '../calendar/calendar-form.html',
                        height: 120,
                    });
                });
            break;
        case "pull_calendar_event":
            preparePullCalendarEventData(t, t.arg('syncedCalendar'))
                .then(function() {
                    return t.popup({
                        title: `Sync with Google Calendar`,
                        url: '../calendar/calendar-form.html',
                        height: 120,
                    });
                })
            break;
        case "patch_calendar_event":
            patchCalendarEvent(t, t.arg('syncedCalendar'))
                .then(function() {
                    // nothing to do, jump back to the calendar form popup
                    return t.popup({
                        title: `Sync with Google Calendar`,
                        url: '../calendar/calendar-form.html',
                        height: 120,
                    });
                });
            break;
        case "create_calendar_event":
            createCalendarEvent(t, t.arg('emailHint'), t.arg('calendar'));
            break;
        case "sync_calendar_list":
            prepareSyncCalendarList(t, t.arg('emailHint'), t.arg('calendar'))
                .then(function() {});
            break;
        case "settings":
            return t.popup({
                title: 'Settings',
                url: '../settings/settings.html',
                height: 200,
            });
        case "fetch_card_synced_calendars_from_attachments":
            t.card('all')
                .then(async function(card) {
                    await prepareFetchCardSyncedCalendarsFromAttachments(t, card)
                        .then(function(newCalendars) {
                            return t.popup({
                                title: `Sync with Google Calendar`,
                                url: '../calendar/calendar-form.html',
                                height: 120,
                            });
                        });
                });
            break;
        case "update_calendar_event_response":
            updateCalendarEventResponse(t, t.arg('syncedCalendar'), t.arg('attendees'))
                .then(function() {
                    t.closePopup();
                })
            break;
        case "prepare_search_contacts":
            prepareSearchContacts(t, selectedEmail)
                .then(function() {
                    t.closePopup();
                });
            break;
    }
};