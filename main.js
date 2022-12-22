import { WillPowerUpAppKey, WillPowerUpAppName } from './constants.js';
import { getTrelloToken } from "./service/auth.js";
import { shouldShowCardSection } from "./service/sections.js";

import { getDurationButton } from "./components/duration/duration-button.js";
import {getDurationBadge, getDurationDetailBadge, getTimeBadge} from "./components/duration/duration-badge.js";
import { getLocationBadge, getLocationDetailBadge } from "./components/location/location-badge.js";
import { getCalendarDetailBadges, onCalendarAttachmentSync } from "./components/calendar/calendar.js";
import { moveCardToArchives } from "./components/card-mover/cards-mover.js";
import { CALENDAR_DOC, PEOPLE_DOC } from "./components/google-account-chooser/account-helper.js";

/* global TrelloPowerUp */
var Promise = TrelloPowerUp.Promise;

let isGoogleAPIKeyReady = function(t) {
    return new Promise(function (resolve) {
        t.get('board', 'shared', 'google_api_key')
            .then(function(google_api_key) {
                if (google_api_key !== undefined && google_api_key !== "") {
                    return resolve(true);
                }
                return resolve(false);
            })
    })
}

// Google API service
let googleAPIScript = document.createElement('script');
let googleAPIServiceLoaded = false;
let googleAPIServiceInitialized = false;
googleAPIScript.src = 'https://apis.google.com/js/api.js';
googleAPIScript.onload = function() {
    googleAPIServiceLoaded = true;
};
document.body.appendChild(googleAPIScript);

TrelloPowerUp.initialize({
    'card-back-section': function (t, options) {
        return new Promise(function (resolve) {
            shouldShowCardSection(t)
                .then(function (yes) {
                    if (yes) {
                        resolve({
                            title: 'Will',
                            icon: './svg/cards-blank.svg',
                            content: {
                                type: 'iframe',
                                url: t.signUrl('./components/card-section/card-section.html'),
                                height: 0,
                            },
                        });
                    } else {
                        resolve(null);
                    }
                });
        });
    },

    'show-settings': function (t, options) {
        return t.popup({
            title: 'Settings',
            url: './components/settings/settings.html',
            height: 1792,
        });
    },

    'board-buttons': function(t, options) {
        return new Promise(async function(resolve) {
            await isGoogleAPIKeyReady(t)
                .then(async function (apiKeyReady) {
                    if (apiKeyReady && googleAPIServiceLoaded && !googleAPIServiceInitialized) {
                        await gapi.load('client', async function () {
                            await t.get('board', 'shared', 'google_api_key')
                                .then(async function (key) {
                                    if (key !== undefined) {
                                        await gapi.client.init({
                                            apiKey: key,
                                            discoveryDocs: [PEOPLE_DOC, CALENDAR_DOC],
                                        });
                                        googleAPIServiceInitialized = true;
                                    }
                                });
                        });
                    }
                });

            resolve([]);
        });
    },

    'card-buttons': function (t, options) {
        return new Promise(async function (resolve) {
            let googleAPIKeyReady = false;
            await isGoogleAPIKeyReady(t)
                .then(function (ready) {
                    googleAPIKeyReady = ready;
                });

            let trelloToken = undefined;
            await getTrelloToken(t)
                .then(async function (token) {
                    trelloToken = token;
                });

            let buttons = [];

            // add buttons that require a Google API key
            if (googleAPIKeyReady) {
                // add location button
                buttons.push({
                    icon: './svg/map-location-dot-solid.svg',
                    text: 'Location',
                    callback: function (t, options) {
                        return t.popup({
                            title: 'Location',
                            url: './components/location/location-card-form.html',
                            height: 264,
                        });
                    }
                });

                // add calendar button
                buttons.push({
                    icon: './svg/calendar-regular.svg',
                    text: 'Calendar',
                    callback: function (t, options) {
                        return t.popup({
                            title: `Sync with Google Calendar`,
                            url: './components/calendar/calendar-form.html',
                            height: 120,
                        });
                    },
                });

                // add contacts button
                buttons.push({
                    icon: './svg/address-card-regular.svg',
                    text: 'Contacts',
                    callback: function (t, options) {
                        return t.popup({
                            title: `Search for a contact`,
                            url: './components/contacts/contacts-form.html',
                            height: 120,
                        });
                    },
                });
            } else {
                buttons.push({
                    icon: './svg/map-location-dot-solid.svg',
                    text: 'Location',
                    callback: function (t, options) {
                        return t.popup({
                            title: 'Google API Key missing',
                            url: './components/google-api-key-required/google-api-key-required.html',
                            height: 100,
                        })
                    }
                });
            }

            // add Poll button
            if (trelloToken !== undefined) {
                buttons.push({
                    icon: './svg/bars-progress-solid.svg',
                    text: 'Poll',
                    callback: function (t, options) {
                        return t.popup({
                            title: 'Add a poll',
                            url: './components/poll/poll-form.html',
                            height: 284,
                        });
                    },
                });
            } else {
                buttons.push({
                    icon: './svg/bars-progress-solid.svg',
                    text: 'Poll',
                    callback: function (t, options) {
                        return t.popup({
                            title: `Authorize ${WillPowerUpAppName}`,
                            url: './components/authorize-trello/authorize.html',
                            height: 120,
                            args: {
                                callback: "poll_creation",
                            },
                        });
                    },
                });
            }

            // add duration button
            buttons.push({
                icon: './svg/clock-regular.svg',
                text: 'Duration',
                callback: getDurationButton,
            });

            return resolve(buttons);
        });
    },

    "card-badges": function (t, options) {
        return new Promise(async function (resolve) {
            let badges = [{
                dynamic: function () {
                    t.card('all')
                        .then(function (card) {
                            t.list('all')
                                .then(function (list) {
                                    // only the first card in the list is allowed to move cards to the destination list
                                    if (card.id === list.cards[0].id) {
                                        moveCardToArchives(t, list);
                                    }
                                });
                        });
                    return {
                        refresh: 120,
                    };
                },
            }];

            await getTimeBadge(t)
                .then(function (timeBadge) {
                    if (timeBadge !== null) {
                        badges.push(timeBadge);
                    }
                });

            resolve(badges);
        });
    },

    "card-detail-badges": function (t, opts) {
        return new Promise(async function (resolve) {
            isGoogleAPIKeyReady(t)
                .then(async function(apiKeyReady) {
                    if (apiKeyReady && googleAPIServiceInitialized) {
                        // check if we need to sync the card calendar data from the "Google Calendar Event" attachment of the card
                        await onCalendarAttachmentSync(t);
                    }
                });

            let badges = [];

            await getCalendarDetailBadges(t, googleAPIServiceInitialized)
                .then(function (calendarBadges) {
                    if (calendarBadges !== null) {
                        calendarBadges.forEach(function(badge) {
                            badges.push(badge);
                        });
                    }
                });

            await getLocationDetailBadge(t)
                .then(function (locationBadge) {
                    if (locationBadge !== null) {
                        badges.push(locationBadge);
                    }
                });

            resolve(badges);
        });
    },

    "list-actions": function (t) {
        return [
            {
                text: "Import Calendar events",
                callback: function (t) {
                    return t.popup({
                        title: `Import Google Calendar events`,
                        url: './components/calendar/calendar-action.html',
                        height: 120,
                    });
                },
            },
        ];
    },
}, {
    appKey: WillPowerUpAppKey,
    appName: WillPowerUpAppName,
});