import { getGoogleAccountToken } from "../google-account-chooser/account-helper.js";
import { getSpotlightedLocation } from "../location/location-badge.js";
import { getTrelloToken } from "../../service/auth.js";
import { WillPowerUpAppName } from "../../constants.js";
import { putCard } from "../../service/api.js";

export const newSyncedCalendar = function(email, calendar) {
    return {
        email: email,
        calendar: calendar,
        event: null,
        hasConferenceLink: false,
    };
};

// chooseCalendar shows the list of calendars for the provided mail address and creates an event in the selected Calendar
export const chooseCalendar = function(t, selectedEmail) {
    // lookup account token
    getGoogleAccountToken(t, selectedEmail)
        .then(async function (token) {
            if (token == null) {
                return t.popup({
                    title: 'Choose a Google Account',
                    url: '../google-account-chooser/account-chooser.html',
                    height: 120,
                    args: {
                        callback: "calendar_chooser",
                        emailHint: selectedEmail,
                    },
                });
            }

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
                                    callback: function (t, opts) {
                                        createCalendarEvent(t, selectedEmail, elem, undefined);
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
                            callback: "sync_calendar",
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
                                    callback: "patch_calendar",
                                    syncedCalendar: syncedCalendar,
                                    emailHint: syncedCalendar.email,
                                },
                            });
                        }

                        // use the provided token
                        gapi.client.setToken(token);

                        // create Google Meet
                        try {
                            let event = await gapi.client.calendar.events.patch({
                                calendarId: syncedCalendar.calendar.id,
                                eventId: syncedCalendar.event.id,
                                summary: trelloData.apiInput.summary,
                                description: trelloData.apiInput.description,
                                location: trelloData.apiInput.location,
                                source: trelloData.apiInput.source,
                                start: trelloData.apiInput.start,
                                end: trelloData.apiInput.end,
                            });
                            syncedCalendar.event = event.result;

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
                                console.log(msg);
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
}

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
                        newSyncedCal.event = event.result;

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
                            console.log(msg);
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
}

export const addGoogleMeetToEvent = function(t, syncedCalendar) {
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
                            callback: "add_calendar_conference",
                            syncedCalendar: syncedCalendar,
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
                            conferenceData: {
                                createRequest: {
                                    conferenceSolutionKey: "hangoutsMeet",
                                    requestId: generateRandomGoogleMeetID(10),
                                },
                            },
                        },
                        conferenceDataVersion: 1,
                    });

                    await t.get('card', 'private', 'calendar_'+syncedCalendar.calendar.id)
                        .then(async function(calendar) {
                            calendar.hasConferenceLink = true;
                            await t.set('card', 'private', 'calendar_'+syncedCalendar.calendar.id, calendar)
                                .then(function() {
                                    // wait a bit so that t.set doesn't interfere with t.alert
                                    setTimeout(function() {
                                        t.alert({
                                            message: 'Google Meet link successfully added !',
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

export const deleteCalendarEvent = function(t, syncedCalendar) {
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
                            callback: "delete_calendar_event",
                            syncedCalendar: syncedCalendar,
                            emailHint: syncedCalendar.email,
                        },
                    });
                }

                // use the provided token
                gapi.client.setToken(token);

                // delete the event
                try {
                    let resp = await gapi.client.calendar.events.delete({
                        calendarId: syncedCalendar.calendar.id,
                        eventId: syncedCalendar.event.id,
                    });
                } catch (resp) {
                    let msg = '';
                    if (resp.result.error !== undefined) {
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
                    // delete event
                    t.set('card', 'private', 'calendar_'+syncedCalendar.calendar.id, undefined)
                        .then(function() {
                            // delete calendar from list
                            t.get('card', 'private', 'synced_calendars')
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
                                .then(function() {
                                    resolve();
                                });
                        });
                }
            });
    });
};

export const getCalendarBadge = function(t) {
    return new Promise(function(resolve) {
        t.get('card', 'private', 'synced_calendars')
            .then(function(syncedCalendars) {
                if (syncedCalendars === undefined || syncedCalendars.length === 0) {
                    resolve(null);
                    return;
                }

                if (syncedCalendars.length === 1) {
                    t.get('card', 'private', 'calendar_'+syncedCalendars[0])
                        .then(function(syncedCalendar) {
                            resolve({
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
                        });
                } else {
                    resolve({
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
                                    emailHint: syncedCalendar.email,
                                },
                            });
                        } else {
                            await pullCalendarEventData(t, googleToken, trelloToken, syncedCalendar, resolve);
                        }
                    });
            });
    });
};

let sanitizeCalendarEventDescription = function(input) {
    let output = input;
    let suffixIndex = output.lastIndexOf("<br><br>Open the ");
    if (suffixIndex >= 0) {
        output = output.substring(0, suffixIndex);
    }
    output = output.replaceAll("<html-blob>", "");
    output = output.replaceAll("</html-blob>", "");
    return output;
}

let pullCalendarEventData = async function(t, googleToken, trelloToken, syncedCalendar, resolve) {
   await t.card('all')
        .then(async function(card) {
            // use the provided token
            gapi.client.setToken(googleToken);

            // fetch the event
            try {
                let event = await gapi.client.calendar.events.get({
                    calendarId: syncedCalendar.calendar.id,
                    eventId: syncedCalendar.event.id,
                });

                await t.get('card', 'private', 'calendar_' + syncedCalendar.calendar.id)
                    .then(async function (calendar) {
                        calendar.event = event.result;

                        if (calendar.event.conferenceData === undefined || Object.keys(calendar.event.conferenceData).length === 0) {
                            calendar.hasConferenceLink = false;
                        } else {
                            calendar.hasConferenceLink = true;
                        }

                        let sanitizedDescription = sanitizeCalendarEventDescription(calendar.event.description);
                        await t.set('card', 'shared', 'map_origin', {
                            description: calendar.event.location,
                            place_id: "",
                        })
                            .then(async function() {
                                await t.set('card', 'shared', 'map_destination', {
                                    description: "",
                                    place_id: "",
                                })
                                    .then(async function() {
                                        await putCard(t, card.id, calendar.event.summary, sanitizedDescription)
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
                                    });
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
}