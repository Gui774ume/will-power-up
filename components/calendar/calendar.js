import { getGoogleAccountToken } from "../google-account-chooser/account-helper.js";
import { getSpotlightedLocation } from "../location/location-badge.js";
import { getTrelloToken } from "../../service/auth.js";
import { WillPowerUpAppName } from "../../constants.js";
import { RequestPacer } from "../../service/utils.js";
import {
    deleteAttachment,
    deleteCard,
    getAttachments,
    getLabels,
    postCard,
    putCard,
    putScopedCardData,
    serializeParams
} from "../../service/api.js";

export const newSyncedCalendar = function(email, calendar) {
    return {
        email: email,
        calendar: calendar,
        event: null,
        hasConferenceLink: false,
        hasEventLink: false,
    };
};

// chooseCalendarAndCreateEvent shows the list of calendars for the provided mail address and creates an event in the selected Calendar
export const chooseCalendarAndCreateEvent = function(t, selectedEmail) {
    // lookup account token
    getGoogleAccountToken(t, selectedEmail)
        .then(async function (token) {
            if (token == null) {
                return t.popup({
                    title: 'Choose a Google Account',
                    url: '../google-account-chooser/account-chooser.html',
                    height: 120,
                    args: {
                        callback: "choose_calendar_and_create_event",
                        emailHint: selectedEmail,
                    },
                });
            }

            // use the provided token
            gapi.client.setToken(token);

            await chooseCalendarAndCallback(t, token, async function (t, opts, calendar) {
                createCalendarEvent(t, selectedEmail, calendar, undefined);
            });
        });
};

export const syncCalendarFromStarredCalendar = function(t, account, calendar) {
    // lookup account token
    return new Promise(function(resolve) {
        getGoogleAccountToken(t, account.email)
            .then(async function (token) {
                if (token == null) {
                    return t.popup({
                        title: 'Choose a Google Account',
                        url: '../google-account-chooser/account-chooser.html',
                        height: 120,
                        args: {
                            callback: "create_calendar_event",
                            emailHint: account.email,
                            calendar: calendar,
                        },
                    });
                }
                // use the provided token
                gapi.client.setToken(token);
                createCalendarEvent(t, account.email, calendar, resolve);
            });
    });
};

export const fetchTrelloCalendarData = function(t) {
    return new Promise(function(resolve, reject) {
        t.card('all')
            .then(function(card) {
                t.board('all')
                    .then(function(board) {
                        getSpotlightedLocation(t)
                            .then(function(location) {
                                t.get('card', 'shared', 'duration')
                                    .then(function(duration) {

                                        let apiInput = {
                                            summary: card.name,
                                            description: (card.desc === '' ? '' : card.desc + '<br><br>') + `Open the <a href="${card.url}">Trello card in ${board.name}</a>`,
                                            location: location === null ? "" : location.description,
                                            source: {
                                                title: board.name,
                                                url: card.url,
                                            },
                                            start: {},
                                            end: {},
                                            extendedProperties: {
                                                private: {
                                                    boardID: board.id,
                                                    cardID: card.id,
                                                }
                                            }
                                        }
                                        if (card.due !== null) {
                                            let dueDate = new Date(Date.parse(card.due));
                                            if (card.start !== null) {
                                                let startDate = new Date(Date.parse(card.start));
                                                apiInput.start.date = startDate.toISOString().split('T')[0];
                                                dueDate.setDate(dueDate.getDate()+1);
                                                apiInput.end.date = dueDate.toISOString().split('T')[0];
                                            } else {
                                                if (duration === undefined || duration.value === 0) {
                                                    reject("you must provide either a start and end date or a date and duration");
                                                    return;
                                                } else {
                                                    apiInput.start.dateTime = dueDate.toISOString();
                                                    dueDate.setMinutes(dueDate.getMinutes() + duration.value);
                                                    apiInput.end.dateTime = dueDate.toISOString();
                                                }
                                            }
                                            resolve({
                                                apiInput: apiInput,
                                                location: location,
                                                duration: duration,
                                                card: card,
                                                board: board,
                                            });
                                        } else {
                                            reject("you must set a date to your card to create an event");
                                        }
                                    })
                            });
                    });
            });
    });
};

export const patchCalendarEvent = function(t, syncedCalendar) {
    return new Promise(function(resolve) {
        fetchTrelloCalendarData(t)
            .then(function(trelloData) {
                // lookup account token
                getGoogleAccountToken(t, syncedCalendar.email)
                    .then(async function (token) {
                        if (token == null) {
                            resolve();
                            return t.popup({
                                title: 'Choose a Google Account',
                                url: '../google-account-chooser/account-chooser.html',
                                height: 120,
                                args: {
                                    callback: "patch_calendar_event",
                                    syncedCalendar: syncedCalendar,
                                    emailHint: syncedCalendar.email,
                                },
                            });
                        }

                        // use the provided token
                        gapi.client.setToken(token);

                        try {
                            let event = await gapi.client.calendar.events.patch({
                                calendarId: syncedCalendar.calendar.id,
                                eventId: syncedCalendar.event.id,
                                summary: trelloData.apiInput.summary,
                                description: trelloData.apiInput.description,
                                location: trelloData.apiInput.location,
                                start: trelloData.apiInput.start,
                                end: trelloData.apiInput.end,
                                maxAttendees: 10,
                            });
                            // clean up large fields to prevent reaching Trello's limit
                            syncedCalendar.event = minimizeGoogleEvent(event.result);

                            // add new calendar entry
                            await t.set('card', 'private', 'calendar_'+syncedCalendar.calendar.id, syncedCalendar)
                                .then(async function() {
                                    // wait a bit so that t.set doesn't interfere with t.alert
                                    setTimeout(function() {
                                        t.alert({
                                            message: 'Event updated !',
                                            duration: 6,
                                        });
                                    }, 1000);
                                });

                        } catch (resp) {
                            let msg = '';
                            if (resp.result !== undefined && resp.result.error !== undefined) {
                                msg = resp.result.error.message;
                            } else {
                                msg = "see console";
                                console.log(resp);
                            }
                            setTimeout(function() {
                                t.alert({
                                    message: `Couldn't update event: ${msg}`,
                                    duration: 6,
                                });
                            }, 1000);
                        } finally {
                            resolve();
                        }
                    });
            })
            .catch(async function(err) {
                t.alert({
                    message: `Couldn't update event: ${err}`,
                    duration: 6,
                });
                resolve();
            });
    });
};

export const fetchGoogleCalendar = function(t, googleToken, calendarID) {
    return new Promise(async function(resolve) {
        // use the provided token
        gapi.client.setToken(googleToken);

        try {
            // fetch the Google Event
            let event = await gapi.client.calendar.calendars.get({
                calendarId: calendarID,
            });
            resolve(event.result);
        } catch (resp) {
            let msg = '';
            if (resp.result !== undefined && resp.result.error !== undefined) {
                msg = resp.result.error.message;
            } else {
                msg = "see console";
                console.log(resp);
            }
            setTimeout(function () {
                t.alert({
                    message: `Couldn't fetch Google Calendar: ${msg}`,
                    duration: 6,
                });
            }, 1000);
            resolve(undefined);
        }
    });
};

export const fetchGoogleEvent = async function(t, googleToken, calendarID, eventID) {
    return new Promise(async function(resolve, reject) {
        // use the provided token
        gapi.client.setToken(googleToken);

        try {
            // fetch the Google Event
            let event = await gapi.client.calendar.events.get({
                calendarId: calendarID,
                eventId: eventID,
                maxAttendees: 10,
            });
            resolve(event.result);
        } catch (resp) {
            let msg = '';
            if (resp.result !== undefined && resp.result.error !== undefined) {
                msg = resp.result.error.message;
            } else {
                msg = "see console";
                console.log(resp);
            }
            setTimeout(function () {
                t.alert({
                    message: `Couldn't fetch Google Event: ${msg}`,
                    duration: 6,
                });
            }, 1000);
            resolve(undefined);
        }
    });
};

export const prepareFetchCardSyncedCalendarsFromAttachments = function(t, card, fromCardBadge=true) {
    let syncedCalendars = [];
    let syncedCalendarsIDs = [];
    return new Promise(async function(resolve) {
        let awaitingToken = false;

        // fetch Trello token
        await getTrelloToken(t)
            .then(async function(trelloToken) {
                if (trelloToken === undefined) {
                    awaitingToken = true

                    if (!fromCardBadge) {
                        return t.popup({
                            title: `Authorize ${WillPowerUpAppName}`,
                            url: '../authorize-trello/authorize.html',
                            height: 120,
                            args: {
                                callback: "fetch_card_synced_calendars_from_attachments",
                            },
                        });
                    }
                } else {
                    if (!fromCardBadge) {
                        // update attachments
                        await getAttachments(t, card.id)
                            .then(function (attachments) {
                                card.attachments = attachments;
                            });
                    }
                }
            });
        if (awaitingToken) {
            // we've had to jump to the account chooser to generate a new token, leave now for now, the account chooser
            // will run this function again.
            resolve(syncedCalendars);
            return;
        }

        if (card.attachments === undefined) {
            card.attachments = [];
        }

        // lookup account tokens
        for (const attachment of card.attachments) {
            if (attachment.name !== "Google Calendar Event") {
                continue;
            }
            let params = new URLSearchParams(attachment.url);
            let email = params.get('email');
            if (email !== null && email !== '') {
                await getGoogleAccountToken(t, email)
                    .then(async function (googleToken) {
                        if (googleToken == null) {
                            awaitingToken = true;

                            if (!fromCardBadge) {
                                return t.popup({
                                    title: 'Choose a Google Account',
                                    url: '../google-account-chooser/account-chooser.html',
                                    height: 120,
                                    args: {
                                        callback: "fetch_card_synced_calendars_from_attachments",
                                    },
                                });
                            }
                        }
                    });
            }
        }
        if (awaitingToken) {
            // we've had to jump to the account chooser to generate a new token, leave now for now, the account chooser
            // will run this function again.
            resolve(syncedCalendars);
            return;
        }

        // we can only reach this point once we've gathered tokens for all the emails in the attachments, we can start
        // computing the list of synced Calendars
        for (const attachment of card.attachments) {
            if (attachment.name !== "Google Calendar Event") {
                continue;
            }
            let params = new URLSearchParams(attachment.url);
            let email = params.get('email');
            if (email !== null && email !== '') {
                await getGoogleAccountToken(t, email)
                    .then(async function (googleToken) {
                        if (googleToken == null) {
                            // should never happen, ignore
                            return;
                        }

                        // fetch calendar
                        let syncedCalendar;
                        await fetchGoogleCalendar(t, googleToken, params.get('calendarID'))
                            .then(function(calendar) {
                                syncedCalendar = newSyncedCalendar(email, calendar);
                            });

                        // fetch event
                        await fetchGoogleEvent(t, googleToken, params.get('calendarID'), params.get('eventID'))
                            .then(function(event) {
                                // clean up large fields to prevent reaching Trello's limit
                                syncedCalendar.event = minimizeGoogleEvent(event);
                                syncedCalendar.hasConferenceLink = googleEventHasConferenceData(event);
                                syncedCalendar.hasEventLink = true;
                            })


                        // save newly created synced calendar
                        await t.set('card', 'private', 'calendar_'+syncedCalendar.calendar.id, syncedCalendar);

                        // push to the list of syncedCalendars
                        syncedCalendars.push(syncedCalendar);
                        syncedCalendarsIDs.push(syncedCalendar.calendar.id);
                    });
            }
        }
        // save the list of synced calendars IDs
        await t.set('card', 'private', 'synced_calendars', syncedCalendarsIDs);

        // we should be done, resolve the synced calendars
        resolve(syncedCalendars);
    });
};

export const prepareSyncCalendarList = function(t, selectedEmail, calendar) {
    return new Promise(async function(resolve) {
        // lookup account token
        await getGoogleAccountToken(t, selectedEmail)
            .then(async function (googleToken) {
                if (googleToken == null) {
                    return t.popup({
                        title: 'Choose a Google Account',
                        url: '../google-account-chooser/account-chooser.html',
                        height: 120,
                        args: {
                            callback: "sync_calendar_list",
                            calendar: calendar,
                            emailHint: selectedEmail,
                        },
                    });
                }

                // select account
                await t.get('board', 'private', selectedEmail)
                    .then(async function(account) {
                        await getTrelloToken(t)
                            .then(async function(trelloToken) {
                                if (trelloToken === undefined) {
                                    return t.popup({
                                        title: `Authorize ${WillPowerUpAppName}`,
                                        url: '../authorize-trello/authorize.html',
                                        height: 120,
                                        args: {
                                            callback: "sync_calendar_list",
                                            calendar: calendar,
                                            emailHint: selectedEmail,
                                        },
                                    });
                                } else {
                                    await t.list('all')
                                        .then(async function(list) {
                                            // lookup syncedCalendar to see if a label was already defined
                                            await t.get('board', 'private', 'synced_calendar_' + list.id + '_' + calendar.id)
                                                .then(async function(syncedCalendar) {
                                                    if (syncedCalendar === undefined) {
                                                        // select label for the calendar
                                                        await chooseLabel(t)
                                                            .then(async function(label) {
                                                                jumpAndExecuteSyncCalendarList(t, googleToken, trelloToken, account, calendar, label, list);
                                                            });
                                                        return;
                                                    }

                                                    jumpAndExecuteSyncCalendarList(t, googleToken, trelloToken, account, calendar, syncedCalendar.label, list);
                                                })
                                        })
                                }
                            });
                    });
            });
    });
};

export const prepareChooseLabel = async function(t, syncedCalendar, list) {
    await getTrelloToken(t)
        .then(async function(trelloToken) {
            if (trelloToken === undefined) {
                return t.popup({
                    title: `Authorize ${WillPowerUpAppName}`,
                    url: '../authorize-trello/authorize.html',
                    height: 120,
                    args: {
                        callback: "choose_label",
                        syncedCalendar: syncedCalendar,
                        list: list,
                    },
                });
            } else {
                await chooseLabel(t)
                    .then(async function(label) {
                        await t.get('board', 'private', 'synced_calendar_' + list.id + '_' + syncedCalendar.calendar.id)
                            .then(async function(syncedCalendar) {
                                if (syncedCalendar === undefined) {
                                    return;
                                }
                                syncedCalendar.label = label;
                                await t.set('board', 'private', 'synced_calendar_' + list.id + '_' + syncedCalendar.calendar.id, syncedCalendar);
                            });
                    });

                return t.popup({
                    title: `Import Google Calendar events`,
                    url: '../calendar/calendar-action.html',
                    height: 120,
                });
            }
        });
}

export const chooseLabel = async function(t) {
    return new Promise(async function(labelResolve) {
        let boardID = '';
        await t.board('id')
            .then(function (board) {
                boardID = board.id;
            });

        let labels = [];
        await getLabels(t, boardID)
            .then(function (boardLabels) {
                if (boardLabels === undefined) {
                    boardLabels = [];
                }
                labels = boardLabels;
            });

        if (labels.length === 0) {
            // no labels on the board, run callback now
            return labelResolve(undefined);
        }

        await t.popup({
            title: 'Choose a label for your calendar',
            items: function (t, options) {
                return new Promise(function (resolve) {
                    let out = [];

                    out.push({
                        text: "No label",
                        callback: async function (t, opts) {
                            return labelResolve(undefined);
                        }
                    });

                    labels.filter(function (label) {
                        if (label.name === '') {
                            return false;
                        }
                        if (options.search === '') {
                            return true;
                        }
                        return label.name.toLowerCase().includes(options.search.toLowerCase());
                    }).map(function (label) {
                        return {
                            text: label.name,
                            callback: async function (t, opts) {
                                return labelResolve(label);
                            },
                        };
                    }).forEach(function (label) {
                        out.push(label);
                    });

                    resolve(out);
                });
            },
            search: {
                debounce: 300,
                placeholder: 'Search label',
                empty: 'No label found',
                searching: 'Searching labels ...'
            }
        });
    });
};

export const jumpAndExecuteSyncCalendarList = function(t, googleToken, trelloToken, account, calendar, label, list) {
    return t.popup({
        title: `Syncing with Google Calendar`,
        url: '../calendar/calendar-loading.html',
        height: 120,
        args: {
            googleToken: googleToken,
            trelloToken: trelloToken,
            account: account,
            calendar: calendar,
            list: list,
            label: label,
            callback: "sync_calendar_list",
        },
    });
};

export const jumpAndDeleteSyncedCalendarEventsFromList = async function(t, syncedCalendar, list) {
    await getTrelloToken(t)
        .then(async function(trelloToken) {
            if (trelloToken === undefined) {
                return t.popup({
                    title: `Authorize ${WillPowerUpAppName}`,
                    url: '../authorize-trello/authorize.html',
                    height: 120,
                    args: {
                        callback: "delete_synced_calendar_events_from_list",
                        syncedCalendar: syncedCalendar,
                        list: list,
                    },
                });
            } else {
                return t.popup({
                    title: `Syncing with Google Calendar`,
                    url: '../calendar/calendar-loading.html',
                    height: 120,
                    args: {
                        syncedCalendar: syncedCalendar,
                        list: list,
                        callback: "delete_synced_calendar_events_from_list",
                    },
                });
            }
        });
};

export const deleteSyncedCalendarEventsFromList = async function(t, syncedCalendar, list, currentIndex, outOfCount) {
    // delete all cards in list
    let requestPacer = new RequestPacer();
    if (list.cards === undefined) {
        list.cards = [];
    }
    outOfCount.innerText = `${list.cards.length}`;

    for (const [i, card] of list.cards.entries()) {
        currentIndex.innerText = `${i + 1}`;
        // check if this card is linked to the calendar that we are removing
        for (const attachment of card.attachments) {
            if (attachment.name === 'Google Calendar Event') {
                let params = new URLSearchParams(attachment.url);
                if (params.get('calendarID') === syncedCalendar.calendar.id) {
                    // delete card
                    await requestPacer.add(deleteCard(t, card.id));
                    break;
                }
            }
        }
    }

    // wait until all cards are deleted
    await requestPacer.wait();

    // remove calendar entry
    await t.set('board', 'private', 'synced_calendar_' + list.id + '_' + syncedCalendar.calendar.id, undefined)
        .then(async function() {
            await t.get('board', 'private', 'synced_calendars_' + list.id)
                .then(async function(calendars) {
                    if (calendars === undefined) {
                        calendars = [];
                    }

                    for (const [i, elem] of calendars.entries()) {
                        if (elem === syncedCalendar.calendar.id) {
                            calendars.splice(i, 1);
                            break;
                        }
                    }
                    await t.set('board', 'private', 'synced_calendars_' + list.id, calendars);
                });
        });
};

export const fetchGoogleEvents = async function(t, googleToken, account, calendar) {
    return new Promise(async function(resolve, reject) {
        let limit = 0;
        await t.get('board', 'shared', 'google_calendar_sync_time_limit')
            .then(function(daysCount) {
                if (daysCount === undefined) {
                    // default to a week
                    limit = 7;
                } else {
                    limit = daysCount.value;
                }
            });

        // fetch the list of all upcoming events
        try {
            let now = new Date();
            let googleEvents = await gapi.client.calendar.events.list({
                'calendarId': calendar.id,
                'timeMin': now.toISOString(),
                'timeMax': new Date(now.setDate(now.getDate() + limit)).toISOString(),
                'maxAttendees': 10,
                'showDeleted': false,
                'singleEvents': true,
                'maxResults': 500,
                'orderBy': 'startTime',
            });
            resolve(googleEvents.result.items);
        } catch (resp) {
            let msg = '';
            if (resp.result !== undefined && resp.result.error !== undefined) {
                msg = resp.result.error.message;
            } else {
                msg = "see console";
                console.log(resp);
            }
            setTimeout(function () {
                t.alert({
                    message: `Couldn't list events: ${msg}`,
                    duration: 6,
                });
            }, 1000);
            reject();
        }
    });
};

export const syncCalendarList = function(t, googleToken, trelloToken, account, calendar, label, list, currentIndex, outOfCount) {
    currentIndex.innerText = '-';
    outOfCount.innerText = '-';
    let labels = []
    if (label !== undefined) {
        labels.push(label);
    }

    return new Promise(async function(resolve) {
        // create calendar entry for the current list
        await t.set('board', 'private', 'synced_calendar_' + list.id + '_' + calendar.id, {
            calendar: calendar,
            email: account.email,
            label: label,
        })
            .then(async function() {
                await t.get('board', 'private', 'synced_calendars_' + list.id)
                    .then(async function(syncedCalendarsIDs) {
                        if (syncedCalendarsIDs === undefined) {
                            syncedCalendarsIDs = [];
                        }

                        let found = false;
                        syncedCalendarsIDs.forEach(function(elem) {
                            if (elem === calendar.id) {
                                found = true;
                            }
                        });
                        if (!found) {
                            syncedCalendarsIDs.push(calendar.id);
                        }
                        await t.set('board', 'private', 'synced_calendars_' + list.id, syncedCalendarsIDs);
                    });
            });

        // lookup board data
        let board = undefined;
        await t.board('all')
            .then(function(boardMetadata) {
                board = boardMetadata;
            });
        if (board === undefined) {
            setTimeout(function() {
                t.alert({
                    message: `Couldn't lookup board`,
                    duration: 6,
                });
            }, 1000);
            resolve();
            return;
        }

        // use the provided token
        gapi.client.setToken(googleToken);

        // fetch the list of upcoming Google events
        await fetchGoogleEvents(t, googleToken, account, calendar)
            .then(async function(googleEvents) {
                let requestPacer = new RequestPacer();
                let existingGoogleEventIDs = [];
                outOfCount.innerText = list.cards.length + googleEvents.length;

                // update existing cards
                for (const [i, card] of list.cards.entries()) {
                    currentIndex.innerText = `${i + 1}`;
                    // extract the google event ID from the attachments of the card
                    let googleEventID = '';
                    let currentEtag = '';
                    for (const attachment of card.attachments) {
                        if (attachment.name === 'Google Calendar Event') {
                            let params = new URLSearchParams(attachment.url);
                            if (params.get('calendarID') === calendar.id) {
                                googleEventID = params.get('eventID');
                                currentEtag = params.get('etag');
                                break;
                            }
                        }
                    }
                    if (googleEventID === '') {
                        // ignore this card, it doesn't have a Google Event
                        continue;
                    }
                    existingGoogleEventIDs.push(googleEventID);

                    // generate the new labels list for the card
                    let cardLabels = card.labels.map(x => x);
                    let calendarLabelFound = false;
                    for (const l of cardLabels) {
                        if (l.name === label.name) {
                            calendarLabelFound = true;
                        }
                    }
                    if (!calendarLabelFound) {
                        cardLabels.push(label);
                    }

                    // find the corresponding Google Event in the list of googleEvents
                    let found = false;
                    for (const googleEvent of googleEvents) {
                        if (googleEvent.id === googleEventID) {
                            found = true;
                            // update the card
                            let cardInput = newCardInputFromGoogleEvent(googleEvent, calendar, account.email, cardLabels);
                            // only update the card if the etags are different
                            if (currentEtag !== googleEvent.etag || !calendarLabelFound) {
                                await requestPacer.add(putCard(t, card.id, cardInput, false), 2+2*cardInput.attachments.length);
                            }
                        }
                    }
                    if (!found) {
                        let now = new Date();
                        if (Date.parse(card.due) - now <= 0 || Date.parse(card.start) - now <= 0) {
                            // ignore this card, it should be moved to the Done column soon
                            continue;
                        }

                        // the event was deleted, delete the card
                        await requestPacer.add(deleteCard(t, card.id));
                    }
                }

                // create new cards
                for (const [i, googleEvent] of googleEvents.entries()) {
                    currentIndex.innerText = `${i + 1 + list.cards.length}`;

                    // check if the card is already in the list
                    let found = false;
                    for (const existingGoogleEventID of existingGoogleEventIDs) {
                        if (existingGoogleEventID === googleEvent.id) {
                            found = true;
                            break;
                        }
                    }
                    if (found) {
                        continue;
                    }

                    // check if this googleEvent contains a reference to another card in the Trello board
                    if (googleEvent.extendedProperties !== undefined && googleEvent.extendedProperties.private !== undefined) {
                        // check the board ID
                        if (googleEvent.extendedProperties.private.boardID === board.id) {
                            continue;
                        }
                    }

                    // create new card for the current Google Event
                    let cardInput = newCardInputFromGoogleEvent(googleEvent, calendar, account.email, labels);
                    cardInput.idList = list.id;
                    await requestPacer.add(postCard(t, cardInput), 1+cardInput.attachments.length);
                }

                await requestPacer.wait();
            })
            .catch(function(err) {
                console.log(`couldn't fetch Google Events: ${err}`);
            });
        resolve();
    });
};

export const createCalendarEvent = function(t, selectedEmail, calendar, resolve) {
    fetchTrelloCalendarData(t)
        .then(function(trelloData) {
            // check if this calendar has already been selected before
            t.get('card', 'private', 'synced_calendars')
                .then(async function(calendars) {
                    if (calendars === undefined) {
                        calendars = [];
                    }

                    let found = false;
                    calendars.forEach(function(calendarID) {
                        if (calendarID === calendar.id) {
                            found = true;
                        }
                    })

                    if (found) {
                        // nothing to do, jump back to the calendar form popup
                        return t.popup({
                            title: `Sync with Google Calendar`,
                            url: '../calendar/calendar-form.html',
                            height: 120,
                        });
                    }

                    // create new calendar entry
                    let newSyncedCal = newSyncedCalendar(selectedEmail, calendar);

                    // create new event
                    try {
                        let event = await gapi.client.calendar.events.insert(
                            {
                                // see https://developers.google.com/calendar/api/v3/reference/events/insert?hl=en_US for more
                                calendarId: calendar.id,
                                summary: trelloData.apiInput.summary,
                                description: trelloData.apiInput.description,
                                location: trelloData.apiInput.location,
                                source: trelloData.apiInput.source,
                                start: trelloData.apiInput.start,
                                end: trelloData.apiInput.end,
                            },
                        );
                        // clean up large fields to prevent reaching Trello's limit
                        newSyncedCal.event = minimizeGoogleEvent(event.result);


                        // add new calendar entry
                        await t.set('card', 'private', 'calendar_'+calendar.id, newSyncedCal)
                            .then(async function() {
                                calendars.push(calendar.id);
                                await t.set('card', 'private', 'synced_calendars', calendars)
                                    .then(function() {
                                        if (resolve === undefined) {
                                            // jump back to the initial calendar popup
                                            return t.popup({
                                                title: `Sync with Google Calendar`,
                                                url: '../calendar/calendar-form.html',
                                                height: 120,
                                            });
                                        }
                                    });
                            });

                    } catch (resp) {
                        let msg = ''
                        if (resp.result !== undefined && resp.result.error !== undefined) {
                            msg = resp.result.error.message;
                        } else {
                            msg = "see console";
                            console.log(resp);
                        }
                        setTimeout(function() {
                            t.alert({
                                message: `Couldn't create event: ${msg}`,
                                duration: 6,
                            });
                        }, 1000);
                    } finally {
                        if (resolve !== undefined) {
                            resolve();
                        }
                    }
                });
        })
        .catch(async function(err) {
            t.alert({
                message: `Couldn't create event: ${err}`,
                duration: 6,
            });
            if (resolve !== undefined) {
                resolve();
            }
        });
};

let generateRandomGoogleMeetID = function(length) {
    var result           = '';
    var characters       = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    var charactersLength = characters.length;
    for ( var i = 0; i < length; i++ ) {
        result += characters.charAt(Math.floor(Math.random() * charactersLength));
    }
    return result;
};

export const toggleCalendarEventMeeting = function(t, syncedCalendar, shouldAdd) {
    return new Promise(function(resolve) {
        // lookup account token
        getGoogleAccountToken(t, syncedCalendar.email)
            .then(async function (token) {
                if (token == null) {
                    resolve();
                    return t.popup({
                        title: 'Choose a Google Account',
                        url: '../google-account-chooser/account-chooser.html',
                        height: 120,
                        args: {
                            callback: "toggle_calendar_event_meeting",
                            syncedCalendar: syncedCalendar,
                            shouldAdd: shouldAdd,
                            emailHint: syncedCalendar.email,
                        },
                    });
                }

                // use the provided token
                gapi.client.setToken(token);

                // create Google Meet
                try {
                    let resp = await gapi.client.calendar.events.patch({
                        calendarId: syncedCalendar.calendar.id,
                        eventId: syncedCalendar.event.id,
                        resource: {
                            conferenceData: shouldAdd ? {
                                createRequest: {
                                    conferenceSolutionKey: "hangoutsMeet",
                                    requestId: generateRandomGoogleMeetID(10),
                                },
                            } : null,
                        },
                        conferenceDataVersion: 1,
                        maxAttendees: 10,
                    });

                    await t.get('card', 'private', 'calendar_'+syncedCalendar.calendar.id)
                        .then(async function(calendar) {
                            calendar.hasConferenceLink = shouldAdd;
                            // clean up large fields to prevent reaching Trello's limit
                            calendar.event = minimizeGoogleEvent(resp.result);
                            await t.set('card', 'private', 'calendar_'+syncedCalendar.calendar.id, calendar)
                                .then(function() {
                                    // wait a bit so that t.set doesn't interfere with t.alert
                                    setTimeout(function() {
                                        t.alert({
                                            message: shouldAdd ? 'Google Meet link successfully added !' : 'Google Meet successfully removed !',
                                            duration: 6,
                                        });
                                    }, 1000);
                                });
                        });
                } catch (resp) {
                    let msg = '';
                    if (resp.result !== undefined && resp.result.error !== undefined) {
                        msg = resp.result.error.message;
                    } else {
                        msg = "see console";
                        console.log(resp);
                    }
                    setTimeout(function() {
                        t.alert({
                            message: `Couldn't add Google Meet: ${msg}`,
                            duration: 6,
                        });
                    }, 1000);
                } finally {
                    resolve();
                }
            });
    });
};

export const deleteGoogleCalendarEvent = function(t, googleEvent, calendar) {
    return new Promise(async function(resolve) {
        try {
            let resp = await gapi.client.calendar.events.delete({
                calendarId: calendar.id,
                eventId: googleEvent.id,
            });
        } catch (resp) {
            let msg = '';
            if (resp.result !== undefined && resp.result.error !== undefined) {
                msg = resp.result.error.message;
            } else {
                msg = "see console";
                console.log(resp);
            }
            setTimeout(function() {
                t.alert({
                    message: `Couldn't delete event: ${msg}`,
                    duration: 6,
                });
            }, 1000);
        } finally {
            resolve();
        }
    });
};

export const prepareDeleteCalendarEvent = function(t, syncedCalendar) {
    return new Promise(function (resolve) {
        // lookup account token
        getGoogleAccountToken(t, syncedCalendar.email)
            .then(async function (googleToken) {
                if (googleToken == null) {
                    resolve();
                    return t.popup({
                        title: 'Choose a Google Account',
                        url: '../google-account-chooser/account-chooser.html',
                        height: 120,
                        args: {
                            callback: "delete_calendar_event",
                            syncedCalendar: syncedCalendar,
                            emailHint: syncedCalendar.email,
                        },
                    });
                }

                await getTrelloToken(t)
                    .then(async function(trelloToken) {
                        if (trelloToken === undefined) {
                            resolve();
                            return t.popup({
                                title: `Authorize ${WillPowerUpAppName}`,
                                url: '../authorize-trello/authorize.html',
                                height: 120,
                                args: {
                                    callback: "delete_calendar_event",
                                    syncedCalendar: syncedCalendar,
                                },
                            });
                        } else {
                            await deleteCalendarEvent(t, googleToken, syncedCalendar)
                                .then(function() {
                                    resolve();
                                });
                        }
                    });
            });
    });
}

export const prepareDeleteAttachment = function(t, cardID, attachmentID) {
    return new Promise(async function(resolve) {
        await getTrelloToken(t)
            .then(async function(trelloToken) {
                if (trelloToken === undefined) {
                    resolve();
                    return t.popup({
                        title: `Authorize ${WillPowerUpAppName}`,
                        url: '../authorize-trello/authorize.html',
                        height: 120,
                        args: {
                            callback: "delete_card_attachment",
                            cardID: cardID,
                            attachmentID: attachmentID,
                        },
                    });
                } else {
                    await deleteAttachment(t, cardID, attachmentID)
                        .then(function() {
                            resolve();
                        });
                }
            });
    });
};

export const deleteCalendarEvent = async function(t, googleToken, syncedCalendar) {
    // use the provided token
    gapi.client.setToken(googleToken);

    // delete the event
    await deleteGoogleCalendarEvent(t, syncedCalendar.event, syncedCalendar.calendar)
        .then(async function() {
            // start by deleting the corresponding card attachment (if there is one)
            await t.card('all')
                .then(async function(card) {
                    if (card.attachments === undefined) {
                        card.attachments = [];
                    }
                    for (const attachment of card.attachments) {
                        if (attachment.name === 'Google Calendar Event') {
                            let params = new URLSearchParams(attachment.url);
                            if (params.get('eventID') !== syncedCalendar.event.id || params.get('calendarID') !== syncedCalendar.calendar.id) {
                                continue;
                            }

                            // delete attachment
                            await deleteAttachment(t, card.id, attachment.id);
                        }
                    }
                });

            // delete event
            await t.set('card', 'private', 'calendar_'+syncedCalendar.calendar.id, undefined)
                .then(async function() {
                    // delete calendar from list
                    await t.get('card', 'private', 'synced_calendars')
                        .then(async function(calendars) {
                            if (calendars === undefined) {
                                return;
                            }
                            let indexToDelete = -1;
                            calendars.forEach(function(elem, id) {
                                if (elem === syncedCalendar.calendar.id) {
                                    indexToDelete = id;
                                }
                            })
                            if (indexToDelete >= 0) {
                                calendars.splice(indexToDelete, 1);
                                await t.set('card', 'private', 'synced_calendars', calendars)
                                    .then(function() {
                                        // wait a bit so that t.set doesn't interfere with t.alert
                                        setTimeout(function() {
                                            t.alert({
                                                message: `Event successfully deleted from ${syncedCalendar.calendar.summary}`,
                                                duration: 6,
                                            });
                                        }, 1000);
                                    });
                            }
                        })
                });
        });
};

export const getCalendarDetailBadges = function(t, googleAPIServiceInitialized) {
    return new Promise(function(resolve) {
        t.get('card', 'private', 'synced_calendars')
            .then(async function(syncedCalendars) {
                let out = [];

                if (syncedCalendars === undefined || syncedCalendars.length === 0) {
                    resolve(out);
                    return;
                }

                if (syncedCalendars.length === 1) {
                    await t.get('card', 'private', 'calendar_'+syncedCalendars[0])
                        .then(function(syncedCalendar) {
                            out.push({
                                title: "Synced with",
                                text: syncedCalendar.calendar.summary,
                                callback: function(t, options) {
                                    return t.popup({
                                        title: `Sync with Google Calendar`,
                                        url: './components/calendar/calendar-form.html',
                                        height: 120,
                                    });
                                },
                            });

                            if (syncedCalendar.event.conferenceData !== undefined && syncedCalendar.event.conferenceData.entryPoints !== undefined && syncedCalendar.event.conferenceData.entryPoints.length > 0) {
                                for (const entryPoint of syncedCalendar.event.conferenceData.entryPoints) {
                                    if (entryPoint.entryPointType === "video") {
                                        out.push({
                                            title: syncedCalendar.event.conferenceData.conferenceSolution.name,
                                            text: syncedCalendar.event.conferenceData.conferenceId,
                                            url: entryPoint.uri,
                                        });
                                    }
                                }
                            }

                            if (syncedCalendar.event.attendees !== undefined && syncedCalendar.event.attendees.length > 0) {
                                syncedCalendar.event.attendees.forEach(function(attendee, attendeeIndex) {
                                    if (attendee.self) {
                                        out.push({
                                            title: "Response",
                                            text: attendee.responseStatus,
                                            callback: function(t, options) {
                                                if (!googleAPIServiceInitialized || gapi.client === undefined) {
                                                    // we won't be able to change the response until the gapi service is initialized, leave now
                                                    return;
                                                }

                                                return t.popup({
                                                    title: 'Update your response',
                                                    items: function (t, options) {
                                                        return new Promise(function (resolve) {
                                                            let out = [];

                                                            out.push({
                                                                text: `Current response: "${attendee.responseStatus}${attendee.comment !== undefined ? ' - '+attendee.comment : ''}"`,
                                                                callback: async function (t, opts) {
                                                                    await t.closePopup();
                                                                },
                                                            })

                                                            let choices = [{
                                                                name: "Accept",
                                                                value: "accepted",
                                                            }, {
                                                                name: "Decline",
                                                                value: "declined",
                                                            }, {
                                                                name: "Tentative",
                                                                value: "tentative",
                                                            }]
                                                            choices.forEach(function(elem) {
                                                                out.push({
                                                                    text: elem.name,
                                                                    callback: async function (t, opts) {
                                                                        // update attendee
                                                                        syncedCalendar.event.attendees[attendeeIndex].responseStatus = elem.value;
                                                                        syncedCalendar.event.attendees[attendeeIndex].comment = options.search;

                                                                        await updateCalendarEventResponse(t, syncedCalendar, syncedCalendar.event.attendees)
                                                                            .then(function() {
                                                                                t.closePopup();
                                                                            })
                                                                    }
                                                                });
                                                            });

                                                            resolve(out);
                                                        });
                                                    },
                                                    search: {
                                                        debounce: 300,
                                                        placeholder: "Add note to response",
                                                    }
                                                });
                                            },
                                        });
                                    }
                                });
                            }
                        });
                } else {
                    out.push({
                        title: "Synced with",
                        text: `${syncedCalendars.length} calendars`,
                        callback: function(t, options) {
                            return t.popup({
                                title: `Sync with Google Calendar`,
                                url: './components/calendar/calendar-form.html',
                                height: 120,
                            });
                        },
                    });
                }

                resolve(out);
            });
    });
};

export const updateCalendarEventResponse = function(t, syncedCalendar, attendees) {
    return new Promise(async function(resolve) {
        // lookup account token
        await getGoogleAccountToken(t, syncedCalendar.email)
            .then(async function (googleToken) {
                if (googleToken == null) {
                    return t.popup({
                        title: 'Choose a Google Account',
                        url: './components/google-account-chooser/account-chooser.html',
                        height: 120,
                        args: {
                            callback: "update_calendar_event_response",
                            syncedCalendar: syncedCalendar,
                            attendees: attendees,
                            emailHint: syncedCalendar.email,
                        },
                    });
                }

                // use the provided token
                gapi.client.setToken(googleToken);

                try {
                    let event = await gapi.client.calendar.events.patch({
                        calendarId: syncedCalendar.calendar.id,
                        eventId: syncedCalendar.event.id,
                        attendees: attendees,
                        maxAttendees: 10,
                    });
                    // clean up large fields to prevent reaching Trello's limit
                    syncedCalendar.event = minimizeGoogleEvent(event.result);


                    // add new calendar entry
                    await t.set('card', 'private', 'calendar_'+syncedCalendar.calendar.id, syncedCalendar)
                        .then(async function() {
                            // wait a bit so that t.set doesn't interfere with t.alert
                            setTimeout(function() {
                                t.alert({
                                    message: 'Response updated !',
                                    duration: 6,
                                });
                            }, 1000);
                        });

                } catch (resp) {
                    let msg = '';
                    if (resp.result !== undefined && resp.result.error !== undefined) {
                        msg = resp.result.error.message;
                    } else {
                        msg = "see console";
                        console.log(resp);
                    }
                    setTimeout(function() {
                        t.alert({
                            message: `Couldn't update response: ${msg}`,
                            duration: 6,
                        });
                    }, 1000);
                } finally {
                    resolve();
                }
            });
    });
};

export const preparePullCalendarEventData = function(t, syncedCalendar) {
    return new Promise(function(resolve) {
        // lookup account token
        getGoogleAccountToken(t, syncedCalendar.email)
            .then(async function (googleToken) {
                if (googleToken == null) {
                    resolve();
                    return t.popup({
                        title: 'Choose a Google Account',
                        url: '../google-account-chooser/account-chooser.html',
                        height: 120,
                        args: {
                            callback: "pull_calendar_event",
                            syncedCalendar: syncedCalendar,
                            emailHint: syncedCalendar.email,
                        },
                    });
                }

                await getTrelloToken(t)
                    .then(async function(trelloToken) {
                        if (trelloToken === undefined) {
                            return t.popup({
                                title: `Authorize ${WillPowerUpAppName}`,
                                url: '../authorize-trello/authorize.html',
                                height: 120,
                                args: {
                                    callback: "pull_calendar_event",
                                    syncedCalendar: syncedCalendar,
                                },
                            });
                        } else {
                            await pullCalendarEventData(t, googleToken, trelloToken, syncedCalendar, resolve);
                        }
                    });
            });
    });
};

let minimizeGoogleEvent = function(googleEvent) {
    return {
        attendees: googleEvent.attendees,
        conferenceData: googleEvent.conferenceData === undefined ? {} : {
            conferenceId: googleEvent.conferenceData.conferenceId,
            conferenceSolution: googleEvent.conferenceData.conferenceSolution === undefined ? {} : {
                name: googleEvent.conferenceData.conferenceSolution.name,
            },
            entryPoints: googleEvent.conferenceData.entryPoints === undefined ? [] : googleEvent.conferenceData.entryPoints.filter(function(elem) {
                return elem.entryPointType === "video";
            }),
        },
        description: "",
        start: googleEvent.start,
        end: googleEvent.end,
        etag: googleEvent.etag,
        id: googleEvent.id,
        location: googleEvent.location,
        summary: googleEvent.summary,
        htmlLink: googleEvent.htmlLink,
    };
}

let sanitizeCalendarEventDescription = function(input) {
    if (input === undefined) {
        return '';
    }
    let output = input;
    let suffixIndex = output.lastIndexOf("Open the ");
    if (suffixIndex >= 0) {
        output = output.substring(0, suffixIndex);
    }
    suffixIndex = output.lastIndexOf("<br><br>");
    if (suffixIndex >= 0) {
        output = output.substring(0, suffixIndex);
    }
    output = output.replaceAll("<html-blob>", "");
    output = output.replaceAll("</html-blob>", "");
    return output;
};

export const generateCalendarAttachment = function(googleEvent, calendar, email, duration) {
    return {
        name: "Google Calendar Event",
        url: googleEvent.htmlLink + serializeParams({
            eventID: googleEvent.id,
            calendarID: calendar.id,
            email: email,
            location: googleEvent.location !== undefined ? googleEvent.location : '',
            etag: googleEvent.etag,
            duration: duration,
        }),
        calendarID: calendar.id,
    };
};

export const generateCardInputFromAttachment = function(params) {
    return {
        location: params.get('location'),
        duration: params.get('duration'),
        etag: params.get('etag'),
    }
};

let googleEventHasConferenceData = function(googleEvent) {
    return googleEvent.conferenceData !== undefined && Object.keys(googleEvent.conferenceData).length !== 0
}

let newCardInputFromGoogleEvent = function(googleEvent, calendar, email, labels=[]) {
    let out = {
        description: sanitizeCalendarEventDescription(googleEvent.description),
        name: googleEvent.summary,
        location: googleEvent.location,
        labels: labels,
    };

    if (googleEventHasConferenceData(googleEvent)) {
        out.hasConferenceLink = false;
    } else {
        out.hasConferenceLink = true;
    }

    // handle event dates
    let googleEventStart = googleEvent.start.dateTime !== undefined ? new Date(Date.parse(googleEvent.start.dateTime)) : (googleEvent.start.date !== undefined ? new Date(new Date(Date.parse(googleEvent.start.date)).setHours(0)) : new Date());
    let googleEventEnd = googleEvent.end.dateTime !== undefined ? new Date(Date.parse(googleEvent.end.dateTime)) : (googleEvent.end.date !== undefined ? new Date(new Date(Date.parse(googleEvent.end.date)).setHours(0)) : new Date());
    if (googleEventStart.getFullYear() === googleEventEnd.getFullYear() && googleEventStart.getMonth() === googleEventEnd.getMonth() && googleEventStart.getDate() === googleEventEnd.getDate()) {
        out.start = null;
        out.due = googleEventStart.toISOString();
        // compute event duration in minutes
        out.duration = Math.floor((Math.abs(googleEventEnd - googleEventStart)/1000)/60);
    } else {
        // this is an all day event make sure the due date is on the correct date
        googleEventEnd.setMinutes(googleEventEnd.getMinutes() - 1);
        out.start = googleEventStart.toISOString();
        out.due = googleEventEnd.toISOString();
        out.duration = 0;
    }

    // generate attachments
    out.attachments = [
        generateCalendarAttachment(googleEvent, calendar, email, out.duration),
    ];

    return out;
};

let pullCalendarEventData = async function(t, googleToken, trelloToken, syncedCalendar, resolve) {
   await t.card('all')
        .then(async function(card) {
            await t.get('card', 'private', 'calendar_' + syncedCalendar.calendar.id)
                .then(async function (calendar) {
                    if (calendar === undefined) {
                        resolve();
                        return;
                    }

                    // use the provided token
                    gapi.client.setToken(googleToken);

                    // fetch the event
                    try {
                        let event = await gapi.client.calendar.events.get({
                            calendarId: syncedCalendar.calendar.id,
                            eventId: syncedCalendar.event.id,
                            maxAttendees: 10,
                        });

                        let cardInput = newCardInputFromGoogleEvent(event.result, calendar, syncedCalendar.email);
                        // clean up large fields to prevent reaching Trello's limit
                        calendar.event = minimizeGoogleEvent(event.result);
                        calendar.hasConferenceLink = cardInput.hasConferenceLink;

                        // we don't want to generate a Google Calendar Event attachment so get rid of it
                        cardInput.attachments = [];

                        await putCard(t, card.id, cardInput, true)
                            .then(async function (newCard) {
                                if (newCard !== undefined) {
                                    await t.set('card', 'private', 'calendar_' + syncedCalendar.calendar.id, calendar)
                                        .then(function () {
                                            // wait a bit so that t.set doesn't interfere with t.alert
                                            setTimeout(function () {
                                                t.alert({
                                                    message: 'Your card was successfully updated using the linked Google Event !',
                                                    duration: 6,
                                                });
                                            }, 1000);
                                        });
                                }
                            });

                    } catch (resp) {
                        let msg = '';
                        if (resp.result !== undefined && resp.result.error !== undefined) {
                            msg = resp.result.error.message;
                        } else {
                            msg = "see console";
                            console.log(resp);
                        }
                        setTimeout(function () {
                            t.alert({
                                message: `Couldn't fetch Google Event: ${msg}`,
                                duration: 6,
                            });
                        }, 1000);
                    } finally {
                        resolve();
                    }

                });
        });
};

// ChooseCalendarAndListEvents shows the list of calendars for the provided mail address and import the Google calendar
// events to the board
export const chooseCalendarAndSyncCalendarList = function(t, selectedEmail) {
    // lookup account token
    getGoogleAccountToken(t, selectedEmail)
        .then(async function (token) {
            if (token == null) {
                return t.popup({
                    title: 'Choose a Google Account',
                    url: '../google-account-chooser/account-chooser.html',
                    height: 120,
                    args: {
                        callback: "choose_calendar_and_sync_calendar_list",
                        emailHint: selectedEmail,
                    },
                });
            }

            await chooseCalendarAndCallback(t, token, async function (t, opts, calendar) {
                await prepareSyncCalendarList(t, selectedEmail, calendar)
                    .then(async function () {
                    });
            });
        });
};

export const chooseCalendarAndCallback = async function(t, token, callback) {
    // use the provided token
    gapi.client.setToken(token);

    try {
        // request calendar list
        let calendars = await gapi.client.calendar.calendarList.list({});

        // open Calendar chooser popup
        t.popup({
            title: 'Choose a calendar',
            items: function (t, options) {
                return new Promise(function (resolve) {
                    let out = [];

                    if (calendars === undefined || calendars.result === undefined) {
                        return resolve(out);
                    }

                    calendars.result.items.filter(function (elem) {
                        if (options.search === '') {
                            return true;
                        }
                        let text = elem.summaryOverride !== undefined ? elem.summaryOverride : elem.summary;
                        return text.toLowerCase().includes(options.search.toLowerCase());
                    }).map(function (elem) {
                        return {
                            text: elem.summaryOverride !== undefined ? elem.summaryOverride : elem.summary,
                            callback: async function (t, opts) {
                                await callback(t, opts, elem);
                            },
                        };
                    }).forEach(function (elem) {
                        out.push(elem);
                    });
                    resolve(out);
                });
            },
            search: {
                debounce: 300,
                placeholder: 'Search calendars',
                empty: 'No calendars found',
                searching: 'Searching Google Calendar...'
            }
        });

    } catch (resp) {
        let msg = ''
        if (resp.result !== undefined && resp.result.error !== undefined) {
            msg = resp.result.error.message;
        } else {
            msg = "see console";
            console.log(resp);
        }
        setTimeout(function() {
            t.alert({
                message: `Couldn't list calendars: ${msg}`,
                duration: 6,
            });
        }, 1000);
    }
}

// chooseCalendarAndStarrCalendar shows the list of calendars for the provided mail address and stars the selected calendar
export const chooseCalendarAndStarrCalendar = function(t, selectedEmail) {
    // lookup account token
    getGoogleAccountToken(t, selectedEmail)
        .then(async function (token) {
            if (token == null) {
                return t.popup({
                    title: 'Choose a Google Account',
                    url: '../google-account-chooser/account-chooser.html',
                    height: 120,
                    args: {
                        callback: "choose_calendar_and_starr_calendar",
                    },
                });
            }

            await chooseCalendarAndCallback(t, token, async function (t, opts, calendar) {
                await toggleStarredGoogleCalendar(t, calendar, selectedEmail, true)
                    .then(async function() {
                        // redirect to settings
                        return t.popup({
                            title: 'Settings',
                            url: '../settings/settings.html',
                            height: 200,
                        });
                    });
            });
        });
};

export const onCalendarAttachmentSync = async function(t) {
    await t.card('all')
        .then(async function(card) {
            // fetch the current Calendar Event etag of the card
            let cachedETag = '';
            await t.get('card', 'shared', 'etag')
                .then(function(etag) {
                    if (etag === undefined) {
                        etag = '';
                    }
                    cachedETag = etag;
                });

            // look for the Google Calendar Event attachment
            for (const attachment of card.attachments) {
                if (attachment.name === 'Google Calendar Event') {
                    let params = new URLSearchParams(attachment.url);
                    if (params.get('etag') !== cachedETag) {
                        // refresh card data from calendar event
                        await putScopedCardData(t, generateCardInputFromAttachment(params));
                        break;
                    }
                }
            }

            // create synced_calendars entries from attachment when applicable
            await t.get('card', 'private', 'synced_calendars')
                .then(async function(calendars) {
                    if (calendars === undefined || calendars.length === 0) {
                        await prepareFetchCardSyncedCalendarsFromAttachments(t, card, true);
                    }
                });
        });
};

export const toggleStarredGoogleCalendar = async function(t, calendar, email, forceStarred=false) {
    return new Promise(async function(resolve) {
        t.get('board', 'private', 'starred_calendars')
            .then(function(starredCalendars) {
                if (starredCalendars === undefined) {
                    starredCalendars = [];
                }

                // check if the current calendar is starred
                let index = -1;
                starredCalendars.forEach(function(starredCalendar, i) {
                    if (starredCalendar.id === calendar.id) {
                        index = i;
                    }
                });

                if (index >= 0) {
                    if (forceStarred) {
                        // nothing to do
                        resolve(true);
                        return;
                    }
                    // remove this calendar from the list of starred calendars
                    t.set('board', 'private', 'calendar_'+calendar.id, undefined)
                        .then(function() {
                            starredCalendars.splice(index, 1);
                            t.set('board', 'private', 'starred_calendars', starredCalendars)
                                .then(function() {
                                    resolve(false);
                                });
                        });
                } else {
                    // add this calendar to the list of starred calendars
                    t.set('board', 'private', 'calendar_'+calendar.id, calendar)
                        .then(function() {
                            starredCalendars.push({
                                id: calendar.id,
                                email: email,
                            });
                            t.set('board', 'private', 'starred_calendars', starredCalendars)
                                .then(function() {
                                    resolve(true);
                                });
                        });
                }
            });
    });
}