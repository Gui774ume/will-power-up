import { CALENDAR_DOC, PEOPLE_DOC } from "../google-account-chooser/account-helper.js";
import { deleteSyncedCalendarEventsFromList, syncCalendarList } from "./calendar.js";

let t = TrelloPowerUp.iframe();
let Promise = TrelloPowerUp.Promise;
let currentIndex = document.getElementById('current_index');
let outOfCount = document.getElementById('out_of_count');
let headerMsg = document.getElementById('header_msg');

// Google API service
let googleAPIInitialized = false;
let googleAPIScript = document.createElement('script');
googleAPIScript.src = 'https://apis.google.com/js/api.js';
googleAPIScript.onload = function() {
    gapi.load('client', async function() {
        await t.get('board', 'shared', 'google_api_key')
            .then(async function (key) {
                await gapi.client.init({
                    apiKey: key,
                    discoveryDocs: [PEOPLE_DOC, CALENDAR_DOC],
                });

                // execute requested action
                triggerCallback();
            });
    });
};

t.render(async function(){
    await t.sizeTo("#loader_wrapper")
        .catch(function (e) {});

    if (!googleAPIInitialized) {
        googleAPIInitialized = true;
        document.body.appendChild(googleAPIScript);
    }
});

let triggerCallback = async function() {
    let calendarName;

    switch (t.arg('callback')) {
        case "sync_calendar_list":
            calendarName = t.arg('calendar').summaryOverride !== undefined ? t.arg('calendar').summaryOverride : t.arg('calendar').summary;
            headerMsg.innerHTML = `Importing events from<br>${calendarName} ...`;
            t.sizeTo("#loader_wrapper").catch(function (e) {});

            syncCalendarList(t, t.arg('googleToken'), t.arg('trelloToken'), t.arg('account'), t.arg('calendar'), t.arg('label'), t.arg('list'), currentIndex, outOfCount)
                .then(function() {
                    t.popup({
                        title: `Import Google Calendar events`,
                        url: '../calendar/calendar-action.html',
                        height: 120,
                    });
                });
            break;
        case "delete_synced_calendar_events_from_list":
            calendarName = t.arg('syncedCalendar').calendar.summaryOverride !== undefined ? t.arg('syncedCalendar').calendar.summaryOverride : t.arg('syncedCalendar').calendar.summary;
            headerMsg.innerHTML = `Deleting events from<br>${calendarName} ...`;
            t.sizeTo("#loader_wrapper").catch(function (e) {});

            deleteSyncedCalendarEventsFromList(t, t.arg('syncedCalendar'), t.arg('list'), currentIndex, outOfCount)
                .then(function() {
                    t.popup({
                        title: `Import Google Calendar events`,
                        url: '../calendar/calendar-action.html',
                        height: 120,
                    });
                })
            break;
    }
};