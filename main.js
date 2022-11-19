import { WillPowerUpAppKey, WillPowerUpAppName } from './constants.js';
import { getToken } from "./service/auth.js";
import { shouldShowCardSection } from "./service/sections.js";

import { getDurationButton } from "./components/duration/duration-button.js";
import { getDurationBadge } from "./components/duration/duration-badge.js";
import { getLocationBadge } from "./components/location/location-badge.js";

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

TrelloPowerUp.initialize({

    'card-back-section': function(t, options){
        return new Promise(function(resolve) {
            shouldShowCardSection(t)
                .then(function(yes) {
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

    'show-settings': function(t, options){
        return t.popup({
            title: 'Settings',
            url: './components/settings/settings.html',
            height: 200,
        });
    },

    'card-buttons': function (t, options) {
        return new Promise(function(resolve) {
            isGoogleAPIKeyReady(t)
                .then(function (googleAPIKeyReady) {
                    getToken(t)
                        .then(function(userToken) {
                            let buttons = [];

                            // add Location button
                            if (googleAPIKeyReady) {
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
                            if (userToken !== undefined) {
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
                                            url: './components/authorize/authorize.html',
                                            height: 120,
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
                });
        });
    },

    "card-badges": function (t, options) {
        return new Promise(function(resolve) {
            t.get('card', 'shared', 'map_origin')
                .then(function(origin) {
                    t.get('card', 'shared', 'duration')
                        .then(function (duration) {
                            let badges = [];
                            if (origin !== undefined && origin.description !== '') {
                                badges.push({
                                    text: "",
                                    icon: './svg/map-location-dot-solid.svg',
                                    color: null,
                                });
                            }
                            if (duration !== undefined && duration.value > 0) {
                                badges.push({
                                    text: duration.name.replace().replaceAll(" minutes", "min").replaceAll(" hour", "h").replaceAll(" hours", "h"),
                                    icon: './svg/clock-regular.svg',
                                    color: null,
                                });
                            }
                            resolve(badges);
                        });
                });
        });
    },

    "card-detail-badges": function (t, opts) {
        return new Promise(function(resolve) {
            let badges = [];
            getDurationBadge(t)
                .then(function(durationBadge) {
                    if (durationBadge !== null) {
                        badges.push(durationBadge);
                    }
                    getLocationBadge(t)
                        .then(function(locationBadge) {
                            if (locationBadge !== null) {
                                badges.push(locationBadge);
                            }
                            resolve(badges);
                        });
                });
        });
    },
}, {
    appKey: WillPowerUpAppKey,
    appName: WillPowerUpAppName,
});