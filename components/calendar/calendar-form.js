import { CALENDAR_DOC, PEOPLE_DOC } from "../google-account-chooser/account-helper.js";
import {
    generateCalendarAttachment,
    patchCalendarEvent, prepareDeleteAttachment,
    prepareDeleteCalendarEvent,
    prepareFetchCardSyncedCalendarsFromAttachments,
    preparePullCalendarEventData,
    syncCalendarFromStarredCalendar,
    toggleCalendarEventMeeting,
    toggleStarredGoogleCalendar,
} from "./calendar.js";

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
        await maybeRenderPage();
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
};

let fetchCardSyncedCalendars = function() {
    return new Promise(function(resolve) {
        t.get('card', 'private', 'synced_calendars')
            .then(async function(calendars) {
                let out = [];
                if (calendars === undefined || calendars.length === 0) {
                    // check in the card attachments if there is a linked calendar
                    await t.card('all')
                        .then(async function(card) {
                            if (card.attachments === undefined) {
                                card.attachments = [];
                            }

                            let found = false;
                            for (const attachment of card.attachments) {
                                if (attachment.name === "Google Calendar Event") {
                                    found = true;
                                }
                            }

                            if (found) {
                                await prepareFetchCardSyncedCalendarsFromAttachments(t, card)
                                    .then(async function(newCalendars) {
                                        if (newCalendars === undefined) {
                                            newCalendars = [];
                                        }
                                        for (const newCalendar of newCalendars) {
                                            out.push(newCalendar);
                                        }
                                    });
                            }
                        });

                } else {
                    for (const syncedCalendar of calendars) {
                        await t.get('card', 'private', 'calendar_' + syncedCalendar)
                            .then(function (calendar) {
                                out.push(calendar);
                            });
                    }
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
    fetchCardSyncedCalendars()
        .then(async function(syncedCalendars) {
            calendarList.innerHTML = '';

            if (syncedCalendars.length === 0) {
                starredCalendarsListWrapper.style.display = 'block';
                return showStarredCalendars();
            } else {
                starredCalendarsListWrapper.style.display = 'none';
            }

            for (const syncedCalendar of syncedCalendars) {
                await t.get('board', 'private', 'starred_calendars')
                    .then(async function(starredCalendars) {
                        let isStarredCalendar = false;
                        if (starredCalendars === undefined) {
                            starredCalendars = [];
                        }
                        starredCalendars.forEach(function(elem) {
                            if (elem.id === syncedCalendar.calendar.id) {
                                isStarredCalendar = true;
                            }
                        });
                        await t.get('board', 'private', syncedCalendar.email)
                            .then(function (account) {
                                if (account !== undefined) {
                                    let node = generateSyncedCalendarNode(syncedCalendar, account, isStarredCalendar);
                                    calendarList.appendChild(node);
                                }
                            });
                    });
            }
            t.sizeTo("#calendar_sync_wrapper")
                .catch(function(e) {});
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
            callback: "choose_calendar_and_create_event",
        },
    });
});

let generateStarredCalendarNode = function (calendar, account) {
    // <div className="calendar-elem">
    //     <div className="calendar-header">
    //         <div>
    //             <img className="calendar-photo"
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
    elem.classList.add('calendar-elem');

    let header = document.createElement('div');
    header.classList.add('calendar-header');
    let imgDiv = document.createElement('div');
    let img = document.createElement('img');
    img.classList.add('calendar-photo');
    if (account.photo !== undefined && account.photo !== '') {
        img.src = account.photo;
    }
    imgDiv.appendChild(img);
    header.appendChild(imgDiv);
    let name = document.createElement('div');
    name.classList.add('calendar-name');
    name.addEventListener('click', function() {
        syncCalendarFromStarredCalendar(t, account, calendar)
            .then(function() {
                maybeRenderPage();
            });
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
};

let generateSyncedCalendarNode = function(syncedCalendar, account, isStarredCalendar) {
    // <div className="calendar-elem">
    //     <div className="calendar-header">
    //         <div>
    //             <img className="calendar-photo"
    //                  src="https://trello-members.s3.amazonaws.com/63637a4a19d3ab0274662fc1/fcd5f66926b503d050814724cda6cb7a/170.png">
    //         </div>
    //         <div className="calendar-name">
    //             <b>Tykrie et Willou</b>
    //             <br>
    //             <em>gui774ume.fournier@gmail.com</em>
    //             <span className="calendar-color" style="background-color: orange;"></span>
    //         </div>
    //     </div>
    //     <div className="calendar-buttons input-wrapper">
    //         <button>
    //             <div className="reverse-icon calendar-button-icon"></div>
    //         </button>
    //         <button>
    //             <div className="star-icon calendar-button-icon"></div>
    //         </button>
    //         <button>
    //             <div className="video-icon calendar-button-icon"></div>
    //         </button>
    //         <button>
    //             <div className="paperclip-icon calendar-button-icon"></div>
    //         </button>
    //         <button>
    //             <div className="download-icon calendar-button-icon"></div>
    //         </button>
    //         <button className="mod-danger">
    //             <div className="trash-icon calendar-button-icon"></div>
    //         </button>
    //     </div>
    // </div>
    let elem = document.createElement('div');
    elem.classList.add('calendar-elem');

    let header = document.createElement('div');
    header.classList.add('calendar-header');
    let imgDiv = document.createElement('div');
    let img = document.createElement('img');
    img.classList.add('calendar-photo');
    if (account.photo !== undefined && account.photo !== '') {
        img.src = account.photo;
    }
    imgDiv.appendChild(img);
    header.appendChild(imgDiv);
    let name = document.createElement('div');
    name.classList.add('calendar-name');
    name.addEventListener('click', function() {
        window.open(syncedCalendar.event.htmlLink, '_blank').focus();
    });
    let nameB = document.createElement('b');
    nameB.innerText = syncedCalendar.calendar.summary;
    let nameColor = document.createElement('span');
    nameColor.classList.add('calendar-color');
    nameColor.style.backgroundColor = syncedCalendar.calendar.backgroundColor;
    let nameNewLine = document.createElement('br');
    let nameEmail = document.createElement('em');
    nameEmail.innerText = syncedCalendar.email;
    name.appendChild(nameB);
    name.appendChild(nameNewLine);
    name.appendChild(nameEmail);
    name.appendChild(nameColor);
    header.appendChild(name);

    let buttons = document.createElement('div');
    buttons.classList.add('calendar-buttons');
    buttons.classList.add('input-wrapper');
    [
        {icon: "reverse-icon", buttonClass: "", callback: onRefreshClick},
        {icon: "star-icon", buttonClass: isStarredCalendar ? "mod-primary" : "", callback: onStarClick},
        {icon: "video-icon", buttonClass: syncedCalendar.hasConferenceLink ? "mod-primary" : "", callback: onConferenceButtonClick},
        {icon: "paperclip-icon", buttonClass: syncedCalendar.hasEventLink ? "mod-primary" : "", callback: onEventLinkClick},
        {icon: "download-icon", buttonClass: "", callback: onPullCalendarEventDataClick},
        {icon: "trash-icon", buttonClass: "mod-danger", callback: onDeleteEventButtonClick},

    ].forEach(function(button) {
        let node = document.createElement('button');
        if (button.buttonClass !== '') {
            node.classList.add(button.buttonClass);
        }
        let icon = document.createElement('div');
        icon.classList.add('calendar-button-icon');
        icon.classList.add(button.icon);
        node.addEventListener('click', function(evt) {
            button.callback(evt, syncedCalendar, account);
        });
        node.appendChild(icon);
        buttons.appendChild(node);
    });

    elem.appendChild(header);
    elem.appendChild(buttons);
    return elem;
};

let onRefreshClick = function(mouseEvent, syncedCalendar, account) {
    patchCalendarEvent(t, syncedCalendar)
        .then(function() {
            maybeRenderPage();
        });
};

let onDeleteEventButtonClick = function(mouseEvent, syncedCalendar, account) {
    prepareDeleteCalendarEvent(t, syncedCalendar)
        .then(function() {
            maybeRenderPage();
        });
};

let onConferenceButtonClick = function(mouseEvent, syncedCalendar, account) {
    t.get('card', 'private', 'calendar_'+syncedCalendar.calendar.id)
        .then(function(calendar) {
            toggleCalendarEventMeeting(t, syncedCalendar, !calendar.hasConferenceLink)
                .then(function () {
                    maybeRenderPage();
                });
        });
};

let onPullCalendarEventDataClick = function(mouseEvent, syncedCalendar, account) {
    preparePullCalendarEventData(t, syncedCalendar)
        .then(function() {
            maybeRenderPage();
        });
};

let onEventLinkClick = async function(mouseEvent, syncedCalendar, account) {
    if (!t.memberCanWriteToModel('card')){
        t.alert({
            message: "Oh no! You don't have permission to add attachments to this card.",
            duration: 6,
        });
        return;
    }
    mouseEvent.target.disabled = true;

    let duration = 0;
    await t.get('card', 'shared', 'duration')
        .then(function(cardDuration) {
            duration = cardDuration.value;
        });

    t.card('all')
        .then(async function(card) {
            if (card.attachments === undefined) {
                card.attachments = [];
            }

            if (!syncedCalendar.hasEventLink) {
                let newAttachment = generateCalendarAttachment(syncedCalendar.event, syncedCalendar.calendar, syncedCalendar.email, duration);

                // check if it the attachment already exists
                let found = false;
                for (const attachment of card.attachments) {
                    if (attachment.name === newAttachment.name && attachment.url === newAttachment.url) {
                        found = true;
                        break;
                    }
                }

                // update card now
                syncedCalendar.hasEventLink = true;
                t.set('card', 'private', 'calendar_' + syncedCalendar.calendar.id, syncedCalendar)
                    .then(function() {
                        maybeRenderPage();
                    });

                if (!found) {
                    t.attach(newAttachment)
                        .then(async function () {
                            mouseEvent.target.disabled = false;
                        });
                } else {
                    mouseEvent.target.disabled = false;
                }

            } else {
                // generate the attachment of the calendar in order to find it in the list of attachments of the card
                let searchedAttachment = generateCalendarAttachment(syncedCalendar.event, syncedCalendar.calendar, syncedCalendar.email, duration);

                // update card now
                mouseEvent.target.disabled = false;
                syncedCalendar.hasEventLink = false;
                t.set('card', 'private', 'calendar_' + syncedCalendar.calendar.id, syncedCalendar)
                    .then(function() {
                        maybeRenderPage();
                    });

                // iterate of the list of attachments and delete the one from this calendar
                if (card.attachments === undefined) {
                    card.attachments = [];
                }

                for (const attachment of card.attachments) {
                    if (attachment.name === searchedAttachment.name && attachment.url === searchedAttachment.url) {
                        await prepareDeleteAttachment(t, card.id, attachment.id);
                        break;
                    }
                }
            }
        });
};

let onStarClick = function(mouseEvent, syncedCalendar, account) {
    // disable button
    mouseEvent.target.disabled = true;
    toggleStarredGoogleCalendar(t, syncedCalendar.calendar, account.email)
        .then(function(isStarred) {
            // update icon
            if (isStarred) {
                mouseEvent.target.classList.add("mod-primary");
            } else {
                mouseEvent.target.classList.remove("mod-primary");
            }

            // enable button again
            mouseEvent.target.disabled = false;
        });
};