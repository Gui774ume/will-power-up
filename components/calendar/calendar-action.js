import { CALENDAR_DOC, PEOPLE_DOC } from "../google-account-chooser/account-helper.js";
import { jumpAndDeleteSyncedCalendarEventsFromList, prepareChooseLabel, prepareSyncCalendarList } from "./calendar.js";

let t = TrelloPowerUp.iframe();
var Promise = TrelloPowerUp.Promise;
let trelloReady = false;
let addGoogleCalendarButton = document.getElementById('add_google_calendar');
let calendarList = document.getElementById('calendar_list');
let starredCalendarsList = document.getElementById('starred_calendars_list');
let starredCalendarsMessage = document.getElementById('starred_calendars_message');
let starredCalendarsListWrapper = document.getElementById('starred_calendars_list_wrapper');

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

let maybeRenderPage = async function() {
    if (googleAPIReady && trelloReady) {
        if (!googleAPIInitialized) {
            await t.get('board', 'shared', 'google_api_key')
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

let fetchListSyncedCalendars = function(listID) {
    return new Promise(function(resolve) {
        t.get('board', 'private', 'synced_calendars_' + listID)
            .then(async function(calendars) {
                let out = [];
                if (calendars === undefined) {
                    return resolve(out);
                }

                for (const calendarID of calendars) {
                    await t.get('board', 'private', 'synced_calendar_' + listID + '_' + calendarID)
                        .then(async function(syncedCalendar) {
                            if (syncedCalendar !== undefined) {
                                out.push(syncedCalendar);
                            }
                        });
                }

                resolve(out);
            });
    });
};

let showStarredCalendars = function() {
    t.get('board', 'private', 'starred_calendars')
        .then(async function(starredCalendars) {
            starredCalendarsList.innerText = '';

            if (starredCalendars === undefined) {
                starredCalendars = [];
            }

            if (starredCalendars.length === 0) {
                starredCalendarsMessage.innerText = 'No starred Calendars yet'
            } else {
                starredCalendarsMessage.innerText = 'Starred calendars on this board'
            }

            for (const starredCalendar of starredCalendars) {
                await t.get('board', 'private', 'calendar_'+starredCalendar.id)
                    .then(async function(calendar) {
                        await t.get('board', 'private', starredCalendar.email)
                            .then(function(account) {
                                if (account !== undefined) {
                                    let node = generateStarredCalendarNode(calendar, account);
                                    starredCalendarsList.appendChild(node);
                                }
                            });
                    })
            }
        })
        .then(function() {
            t.sizeTo("#calendar_sync_wrapper")
                .catch(function(e) {});
        });
};

let renderPage = function() {
    t.list('all')
        .then(function(list) {
            fetchListSyncedCalendars(list.id)
                .then(async function (syncedCalendars) {
                    calendarList.innerHTML = '';

                    if (syncedCalendars.length === 0) {
                        starredCalendarsListWrapper.style.display = 'block';
                        return showStarredCalendars();
                    } else {
                        starredCalendarsListWrapper.style.display = 'none';
                    }

                    for (const[i, syncedCalendar] of syncedCalendars.entries()) {
                        await t.get('board', 'private', syncedCalendar.email)
                            .then(function(account) {
                                if (account !== undefined) {
                                    let node = generateSyncedCalendarNode(syncedCalendar, account, list, i);
                                    calendarList.appendChild(node);
                                }
                            });
                    }
                    t.sizeTo("#calendar_sync_wrapper")
                        .catch(function (e) {
                        });
                });
        });
};

t.render(function(){
    trelloReady = true;
    maybeRenderPage();
});

addGoogleCalendarButton.addEventListener('click', function() {
    // jump to the Google Account chooser page, configure callback
    return t.popup({
        title: 'Choose a Google Account',
        url: '../google-account-chooser/account-chooser.html',
        height: 120,
        args: {
            callback: "choose_calendar_and_sync_calendar_list",
        },
    });
});

let generateStarredCalendarNode = function (calendar, account) {
    // <div className="account-elem">
    //     <div className="calendar-header">
    //         <div>
    //             <img className="calendar-icon"
    //                  src="https://trello-members.s3.amazonaws.com/63637a4a19d3ab0274662fc1/fcd5f66926b503d050814724cda6cb7a/170.png">
    //         </div>
    //         <div className="calendar-name">
    //             <b>Tykrie et Willou</b>
    //             <br>
    //             <em>gui774ume.fournier@gmail.com</em>
    //             <span className="calendar-color" style="background-color: orange;"></span>
    //         </div>
    //     </div>
    // </div>
    let elem = document.createElement('div');
    elem.classList.add('account-elem');

    let header = document.createElement('div');
    header.classList.add('calendar-header');
    let imgDiv = document.createElement('div');
    let img = document.createElement('img');
    img.classList.add('calendar-icon');
    if (account.photo !== undefined && account.photo !== '') {
        img.src = account.photo;
    }
    imgDiv.appendChild(img);
    header.appendChild(imgDiv);
    let name = document.createElement('div');
    name.classList.add('calendar-name');
    name.addEventListener('click', function() {
        prepareSyncCalendarList(t, account.email, calendar)
            .then(async function() {});
    });
    let nameB = document.createElement('b');
    nameB.innerText = calendar.summary;
    let nameColor = document.createElement('span');
    nameColor.classList.add('calendar-color');
    nameColor.style.backgroundColor = calendar.backgroundColor;
    let nameNewLine = document.createElement('br');
    let nameEmail = document.createElement('em');
    nameEmail.innerText = account.email;
    name.appendChild(nameB);
    name.appendChild(nameNewLine);
    name.appendChild(nameEmail);
    name.appendChild(nameColor);
    header.appendChild(name);

    elem.appendChild(header);
    return elem;
}

let generateSyncedCalendarNode = function(syncedCalendar, account, list, indexInList) {
    // <div>
    //     <div className="account-elem">
    //         <div className="trash-icon-wrapper">
    //             <span role="img" className="trash-icon input-icon"></span>
    //         </div>
    //         <div class="calendar-name">
    //             <b>Tykrie et Willou</b>
    //             <br>
    //             <em>gui77aume.fournier@gmail.com</em>
    //             <span className="calendar-color" style="background-color: orange;"></span>
    //         </div>
    //     </div>
    //     <div className="input-wrapper" style="margin-bottom: 0; margin-top: 10px;">
    //         <button>Set a label</button>
    //         <button className="mod-danger">Delete</button>
    //     </div>
    // </div>
    let calendarWrapper = document.createElement('div');
    calendarWrapper.classList.add('calendar-wrapper');
    if (indexInList > 0) {
        calendarWrapper.style.marginTop = '10px';
    }

    let calendarElem = document.createElement('div');
    calendarElem.classList.add('account-elem');
    let iconWrapper = document.createElement('div');
    iconWrapper.classList.add("trash-icon-wrapper");
    let icon = document.createElement('span');
    icon.role = "img";
    icon.classList.add("reverse-icon");
    icon.classList.add("input-icon");
    icon.addEventListener('click', async function(evt) {
        prepareSyncCalendarList(t, account.email, syncedCalendar.calendar)
            .then(function() {});
    });
    iconWrapper.appendChild(icon);
    calendarElem.appendChild(iconWrapper);

    let metadataWrapper = document.createElement('div');
    metadataWrapper.style.cursor = "pointer";
    metadataWrapper.addEventListener('click', function(evt) {
        prepareSyncCalendarList(t, account.email, syncedCalendar.calendar)
            .then(function() {});
    });
    let calendarName = document.createElement('b');
    calendarName.innerText = syncedCalendar.calendar.summary;
    let newLine = document.createElement('br');
    let name = document.createElement('em');
    name.innerText = account.email;
    let nameColor = document.createElement('span');
    nameColor.classList.add('calendar-color');
    nameColor.style.backgroundColor = syncedCalendar.calendar.backgroundColor;
    metadataWrapper.appendChild(calendarName);
    metadataWrapper.appendChild(newLine);
    metadataWrapper.appendChild(name);
    metadataWrapper.appendChild(nameColor);
    calendarElem.appendChild(metadataWrapper);
    calendarWrapper.appendChild(calendarElem);

    let buttonsWrapper = document.createElement('div');
    buttonsWrapper.classList.add("input-wrapper");
    buttonsWrapper.style.marginBottom = '0px';
    buttonsWrapper.style.marginTop = '10px';
    let labelButton = document.createElement('button');
    if (syncedCalendar.label !== undefined) {
        labelButton.innerText = `Label: ${syncedCalendar.label.name}`;
    } else {
        labelButton.innerText = "Set a label";
    }
    labelButton.addEventListener('click', function() {
        prepareChooseLabel(t, syncedCalendar, list)
            .then(function() {});
    });
    let deleteButton = document.createElement('button');
    deleteButton.classList.add('mod-danger');
    deleteButton.style.marginLeft = '10px';
    deleteButton.innerText = "Delete"
    deleteButton.addEventListener('click', function() {
        jumpAndDeleteSyncedCalendarEventsFromList(t, syncedCalendar, list)
            .then(function() {});
    });
    buttonsWrapper.appendChild(labelButton);
    buttonsWrapper.appendChild(deleteButton);
    calendarWrapper.appendChild(buttonsWrapper);
    return calendarWrapper;
}
