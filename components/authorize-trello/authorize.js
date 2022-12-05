import { WillPowerUpAppKey, WillPowerUpAppName } from '../../constants.js';
import { sanitizeInput } from "../../service/utils.js";
import {
    jumpAndDeleteSyncedCalendarEventsFromList,
    prepareDeleteCalendarEvent,
    preparePullCalendarEventData,
    prepareSyncCalendarList,
    prepareDeleteAttachment,
} from "../calendar/calendar.js";
import { CALENDAR_DOC, PEOPLE_DOC } from "../google-account-chooser/account-helper.js";

let t = TrelloPowerUp.iframe({
    appKey: WillPowerUpAppKey,
    appName: WillPowerUpAppName,
});
let trelloReady = false;

var trelloAuthUrl = `https://trello.com/1/authorize?expiration=never&name=${sanitizeInput(WillPowerUpAppName)}`+
    `&scope=read,write&key=${WillPowerUpAppKey}&callback_method=fragment&return_url=${window.location.href.substring(0, window.location.href.lastIndexOf('/'))}/auth-callback.html`;

var isTokenValid = function(token) {
    // If this returns false, the Promise won't resolve.
    if (/^[0-9a-f]{64}$/.test(token)) {
        return true;
    }
    // indicate that authorization failed
    t.alert({
        message: "Authorization process aborted",
        duration: 6,
    });
}

// Google API service
let googleAPIReady = false;
let googleAPIInitialized = false;
let googleAPIScript = document.createElement('script');
googleAPIScript.src = 'https://apis.google.com/js/api.js';
googleAPIScript.onload = function() {
    gapi.load('client', async function() {
        googleAPIReady = true;
        maybeRenderPage();
    });
};
document.body.appendChild(googleAPIScript);

let maybeRenderPage = function() {
    if (googleAPIReady && trelloReady) {
        if (!googleAPIInitialized) {
            t.get('board', 'shared', 'google_api_key')
                .then(async function (key) {
                    await gapi.client.init({
                        apiKey: key,
                        discoveryDocs: [PEOPLE_DOC, CALENDAR_DOC],
                    });
                    googleAPIInitialized = true;
                });
        }
        renderPage();
    }
}

t.render(function(){
    trelloReady = true;
    maybeRenderPage();
});

let renderPage = function() {
    t.sizeTo("#authorize_wrapper");

    document.getElementById('authorize').addEventListener('click', function(){
        t.authorize(trelloAuthUrl, { height: 680, width: 580, validToken: isTokenValid})
            .then(function(token){
                // store the token in Trello private Power-Up storage
                return t.set('member', 'private', 'token', token);
            })
            .then(function(){
                let callback = t.arg('callback');
                if (callback === undefined) {
                    return t.closePopup();
                }

                switch (callback) {
                    case "poll_creation":
                        return t.popup({
                            title: 'Add a poll',
                            url: '../poll/poll-form.html',
                            height: 284,
                        });
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
                    case "delete_synced_calendar_events_from_list":
                        jumpAndDeleteSyncedCalendarEventsFromList(t, t.arg('syncedCalendar'), t.arg('list'))
                            .then(function() {});
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
                    case "delete_card_attachment":
                        prepareDeleteAttachment(t, t.arg('cardID'), t.arg('attachmentID'))
                            .then(function() {});
                        break;
                }
            });
    });
};