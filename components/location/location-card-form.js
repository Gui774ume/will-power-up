let t = TrelloPowerUp.iframe();
var Promise = TrelloPowerUp.Promise;

let navigationModes = [
    document.getElementById('place'),
    document.getElementById('car'),
    document.getElementById('bus'),
    document.getElementById('bike'),
    document.getElementById('walk'),
    document.getElementById('search'),
    document.getElementById('plane'),
];
let addStopButton = document.getElementById('add_stop');
let removeStopButton = document.getElementById('remove_stop');
let reverseButton = document.getElementById('reverse');
let satelliteViewButton = document.getElementById('satellite_view');
let paperclipButton = document.getElementById('paperclip');
let removeGoogleMapButton = document.getElementById('remove_google_map');
let okGoogleMapButton = document.getElementById('ok_google_map');
let destinationField = document.getElementById('destination');
let originField = document.getElementById('origin');
let stopsWrapper = document.getElementById('stops');
let placesService;

let disableDestination = function() {
    // reset origin placeholder
    originField.placeholder = "Location (ex: 620 8th avenue)";
    // reset destination value
    destinationField.value = "";
    // disable main destination field
    destinationField.disabled = true;
    // disable "stops" buttons
    addStopButton.disabled = true;
    removeStopButton.disabled = true;
    reverseButton.disabled = true;
    // remove existing stops
    stopsWrapper.innerHTML = '';
}

let enableDestination = function() {
    // set origin placeholder as origin
    originField.placeholder = "Origin (ex: 620 8th avenue)";
    // enable main destination field
    destinationField.disabled = false;
    // enable "stops" buttons
    addStopButton.disabled = false;
    removeStopButton.disabled = false;
    reverseButton.disabled = false;
}

let fetchFormData = function(t) {
    t.get('card', 'shared', 'map_navigation_mode')
        .then(function (mode) {
            if (mode === undefined) {
                mode = "place";
                t.set('card', 'shared', 'map_navigation_mode', mode);
            }

            navigationModes.forEach((elem, i) => {
                if (elem == null) {
                    return;
                }
                // select the current button
                if (elem.id === mode) {
                    elem.classList.add("mod-primary");
                } else {
                    elem.classList.remove("mod-primary");
                }
            })

            // fetch satellite view state
            t.get('card', 'shared', 'map_satellite_view')
                .then(function(satelliteView) {
                    if (satelliteView === undefined) {
                        satelliteView = false;
                    }
                    if (satelliteView) {
                        satelliteViewButton.classList.add("mod-primary");
                    } else {
                        satelliteViewButton.classList.remove("mod-primary");
                    }
                });

            // fetch origin
            t.get('card', 'shared', 'map_origin')
                .then(function (origin) {
                    if (origin !== undefined) {
                        originField.value = origin.description;
                    }
                })
                .then(function() {
                    t.sizeTo('#card_location_settings');
                });

            // update the destination and stop input fields
            switch (mode) {
                case "place":
                case "search":
                    disableDestination();
                    break;
                case "car":
                case "bus":
                case "bike":
                case "plane":
                case "walk":
                    enableDestination();

                    // fetch origin
                    t.get('card', 'shared', 'map_destination')
                        .then(function (destination) {
                            if (destination !== undefined) {
                                destinationField.value = destination.description;
                            }
                        })
                        .then(function() {
                            stopsWrapper.innerHTML = '';
                            t.get('card', 'shared', 'map_stops')
                                .then(function(stops) {
                                    if (stops === undefined) {
                                        return;
                                    }
                                    stops.forEach((elem, i) => {
                                        let stopInput = document.createElement("input");
                                        stopInput.id = "stop"+i;
                                        stopInput.type = "text";
                                        stopInput.autocomplete = "off";
                                        stopInput.placeholder = 'Stop (ex: 18 W 4th St")';
                                        stopInput.classList.add("location-input");
                                        stopInput.value = elem.description;
                                        stopsWrapper.appendChild(stopInput);
                                        setupInputField("stop"+i);
                                    })
                                })
                                .then(function() {
                                    t.sizeTo('#card_location_settings');
                                });
                        })
                        .then(function() {
                            t.sizeTo('#card_location_settings');
                        });
                    break;
            }
        });
}

t.render(function(){
    // update form
    fetchFormData(t);
    // load Google Places API
    t.get('board', 'shared', 'google_api_key')
        .then(function(google_api_key) {
            t.get('board', 'shared', 'google_maps_autocomplete')
                .then(function(autocompleteEnabled) {
                    if (autocompleteEnabled === undefined || autocompleteEnabled === true) {
                        var googlePlacesAPIScript = document.createElement('script');
                        googlePlacesAPIScript.src = `https://maps.googleapis.com/maps/api/js?key=${google_api_key}&libraries=places`
                        googlePlacesAPIScript.onload = function () {
                            placesService = new google.maps.places.AutocompleteService();
                        }
                        document.body.appendChild(googlePlacesAPIScript);
                    }
                });
        });

});

let onSelectNavigationMode = function(mode) {
    t.set('card', 'shared', 'map_navigation_mode', mode)
        .then(function () {
            fetchFormData(t);
        });
}

let resolveSearchPopupCurrentValue = function(t, searchInputID) {
    let defaultValue = "Search query";
    return new Promise(function (resolve) {
        if (searchInputID.includes("stop")) {
            if (searchInputID === "stop") {
                return resolve({
                    currentValue: defaultValue,
                    stopIndex: -1
                });
            }
            let index = parseInt(searchInputID.substring(4));
            if (isNaN(index)) {
                return resolve({
                    currentValue: defaultValue,
                    stopIndex: -1
                });
            }
            t.get('card', 'shared', 'map_stops')
                .then(function(stops) {
                    if (stops === undefined || stops.length < index) {
                        return resolve({
                            currentValue: defaultValue,
                            stopIndex: -1
                        });
                    }
                    return resolve({
                        currentValue: stops[index],
                        stopIndex: index
                    });
                });
        } else {
            t.get('card', 'shared', 'map_'+searchInputID)
                .then(function(currentValue) {
                    if (currentValue === undefined) {
                        currentValue = defaultValue;
                    }
                    return resolve({
                        currentValue: currentValue,
                        stopIndex: -1
                    });
                });
        }
    })
}

let openLocationCardFormPopup = function () {
    return t.popup({
        title: 'Location',
        url: 'location-card-form.html',
        height: 182,
    });
}

let selectSearchOption = function(t, searchInputID, stopIndex, selectedValue, jumpToLocationForm=true) {
    return function(t) {
        if (searchInputID.includes("stop")) {
            return t.get('card', 'shared', 'map_stops')
                .then(function (stops) {
                    if (stops === undefined) {
                        stops = [selectedValue];
                    } else if (stopIndex >= 0) {
                        stops[stopIndex] = selectedValue;
                    } else {
                        stops.push(selectedValue);
                    }
                    return t.set('card', 'shared', 'map_stops', stops)
                        .then(function() {
                            if (jumpToLocationForm) {
                                openLocationCardFormPopup();
                            }
                    });
                });
        } else {
            return t.set('card', 'shared', 'map_' + searchInputID, selectedValue)
                .then(function() {
                    if (jumpToLocationForm) {
                        openLocationCardFormPopup();
                    }
                });
        }
    }
}

let searchPopup = function(t, searchInputID){
    resolveSearchPopupCurrentValue(t, searchInputID)
        .then(function (data) {
            let currentValue = data.currentValue;
            let stopIndex = data.stopIndex;
            return t.popup({
                title: 'Location finder',
                items: function (t, options) {
                    return new Promise(function (resolve) {
                        let output = [];
                        // Add static items
                        if (options.search !== undefined && options.search !== "") {
                            // add static option for query strings and GPS coordinates
                            output.push({
                                text: "Use '" + options.search + "'",
                                alwaysVisible: true,
                                callback: selectSearchOption(t, searchInputID, stopIndex, {
                                    description: options.search,
                                    place_id: "",
                                }),
                            })
                        } else {
                            if (currentValue !== undefined && currentValue.description !== "") {
                                // add static option to clear input
                                output.push({
                                    text: "Clear search",
                                    alwaysVisible: true,
                                    callback: selectSearchOption(t, searchInputID, stopIndex, {
                                        description: "",
                                        place_id: "",
                                    }),
                                })
                                options.search = currentValue.description;
                            }
                        }

                        // add Google Places autocomplete results
                        if (placesService !== undefined && options.search !== undefined && options.search !== "") {
                            return placesService.getQueryPredictions({ input: options.search }, function (predictions, status) {
                                if (status !== google.maps.places.PlacesServiceStatus.OK || !predictions) {
                                    return resolve(output);
                                }

                                predictions.map(function (elem) {
                                    return {
                                        text: elem.description,
                                        callback: selectSearchOption(t, searchInputID, stopIndex, elem),
                                    };
                                }).forEach(function (item) {
                                    output.push(item);
                                });
                                return resolve(output);
                            });
                        } else {
                            return resolve(output);
                        }
                    });
                },
                search: {
                    count: 6,
                    placeholder: currentValue.description,
                    empty: 'Nothing found',
                    searching: 'Working on it ...',
                    debounce: 1000,
                }
            });
        });
};

let setupInputField = function(searchInputID) {
    document.getElementById(searchInputID).addEventListener('click', function(){
        if (document.getElementById(searchInputID).disabled) {
            return;
        }
        t.get('board', 'shared', 'google_maps_autocomplete')
            .then(function(autocompleteEnabled) {
                if (autocompleteEnabled === undefined || autocompleteEnabled === true) {
                    searchPopup(t, searchInputID);
                }
            });
    });

    document.getElementById(searchInputID).addEventListener('change', function(e) {
        if (document.getElementById(searchInputID).disabled) {
            return;
        }
        t.get('board', 'shared', 'google_maps_autocomplete')
            .then(function(autocompleteEnabled) {
                if (autocompleteEnabled !== undefined && autocompleteEnabled === false) {
                    resolveSearchPopupCurrentValue(t, searchInputID)
                        .then(function (data) {
                            selectSearchOption(t, searchInputID, data.stopIndex, {
                                description: e.target.value,
                                place_id: "",
                            }, false)(t);
                        });
                }
            });
    })
};

setupInputField('origin');
setupInputField('destination');

addStopButton.addEventListener("click", function() {
    if (addStopButton.disabled) {
        // nothing to do
        return;
    }
    t.get('card', 'shared', 'map_stops')
        .then(function(stops) {
            if (stops === undefined) {
                stops = [];
            }
            if (stops.length >= 20) {
                t.alert({
                    message: "You can't add more that 20 additional waypoints to your direction query",
                    duration: 6,
                });
                return;
            }
            stops.push({
                description: "",
                place_id: "",
            });
            t.set('card', 'shared', 'map_stops', stops)
                .then(function() {
                    return fetchFormData(t);
                });
        });
})

removeStopButton.addEventListener('click', function() {
    if (removeStopButton.disabled) {
        // nothing to do
        return;
    }
    t.get('card', 'shared', 'map_stops')
        .then(function(stops) {
            if (stops === undefined) {
                return;
            }
            if (stops.length > 0) {
                t.set('card', 'shared', 'map_stops', stops.slice(0, stops.length - 1))
                    .then(function () {
                        return fetchFormData(t);
                    });
            }
        });
})

reverseButton.addEventListener('click', function() {
    if (reverseButton.disabled) {
        // nothing to do
        return;
    }
    t.get('card', 'shared', 'map_origin')
        .then(function(origin) {
            if (origin === undefined) {
                return;
            }
            t.get('card', 'shared', 'map_destination')
                .then(function(destination) {
                    if (destination === undefined) {
                        return;
                    }
                    t.set('card', 'shared', 'map_origin', destination)
                        .then(function () {
                            t.set('card', 'shared', 'map_destination', origin)
                                .then(function () {
                                    fetchFormData(t);
                                });
                        });
                })
        });
})

removeGoogleMapButton.addEventListener('click', function() {
    t.set('card', 'shared', 'map_enabled', false)
        .then(function() {
            fetchFormData(t);
        });
});

okGoogleMapButton.addEventListener('click', function() {
    t.set('card', 'shared', 'map_enabled', true)
        .then(function() {
            fetchFormData(t);
        });
});

satelliteViewButton.addEventListener('click', function() {
    t.get('card', 'shared', 'map_satellite_view')
        .then(function(satelliteView) {
            if (satelliteView === undefined) {
                satelliteView = true;
            } else {
                satelliteView = !satelliteView;
            }
            t.set('card', 'shared', 'map_satellite_view', satelliteView)
                .then(function() {
                    fetchFormData(t);
                });
        });
})

paperclipButton.addEventListener('click', function() {
    if (!t.memberCanWriteToModel('card')){
        t.alert({
            message: "Oh no! You don't have permission to add attachments to this card.",
            duration: 6,
        });
        return;
    }
    paperclipButton.disabled = true;
    t.get('card', 'shared', 'map_navigation_mode')
        .then(function(mode) {
            t.get('card', 'shared', 'map_origin')
                .then(function(origin) {
                    if (origin === undefined || origin === "") {
                        paperclipButton.disabled = false;
                        return;
                    }
                    switch (mode) {
                        case "car":
                        case "bus":
                        case "walk":
                        case "plane":
                        case "bike":
                            t.get('card', 'shared', 'map_destination')
                                .then(function(destination) {
                                    t.get('card', 'shared', 'map_stops')
                                        .then(function(stops) {
                                            let directionsURL = "https://www.google.com/maps/dir/?api=1"+sanitizeInput(buildDirectionsQueryLink(origin, destination, stops, mode));
                                            t.attach({
                                                name: `Directions from ${origin.description} to ${destination.description}`,
                                                url: directionsURL,
                                            }).then(function() {
                                                paperclipButton.disabled = false;
                                            });
                                        });
                                });
                            break;
                        case "search":
                        case "place":
                        default:
                            let searchURL = "https://www.google.com/maps/search/?api=1"+sanitizeInput(buildSearchQueryLink(origin));
                            t.attach({
                                name: origin.description,
                                url: searchURL,
                            }).then(function() {
                                paperclipButton.disabled = false;
                            });
                            break;
                    }
                });
        });
})

let sanitizeInput = function (input) {
    return input.replaceAll(' ', '%20').replaceAll('+', '%2B')
}

let buildSearchQueryLink = function (elem) {
    if (elem === undefined || elem.description === undefined || elem.description === "") {
        return "";
    }
    let query = "&query="+elem.description;
    if (elem.place_id !== undefined && elem.place_id !== "") {
        query += "&query_place_id="+elem.place_id;
    }
    return query;
}

let buildDirectionsQueryLink = function (origin, destination, stops, mode) {
    let query = "";
    if (origin === undefined || origin.description === undefined || origin.description === "") {
        return "";
    } else {
        query += "&origin="+origin.description;
    }
    if (origin.place_id !== undefined && origin.place_id !== "") {
        query += "&origin_place_id="+origin.place_id;
    }
    if (destination === undefined || destination.description === undefined || destination.description === "") {
        return "";
    } else {
        query += "&destination="+destination.description;
    }
    if (destination.place_id !== undefined || destination.place_id !== "") {
        query += "&destination_place_id="+destination.place_id;
    }
    if (stops !== undefined && !isNaN(stops.length) && stops.length > 0) {
        let waypoints = "&waypoints=";
        let waypointsPlaceIDs = "&waypoint_place_ids=";
        stops.forEach((elem, i) => {
            if (i >= 20) {
                return;
            }
            if (elem.description === undefined || elem.description === "") {
                return;
            }
            if (elem.place_id === undefined || elem.place_id === "") {
                return;
            }
            if (i > 0) {
                waypoints += "|"
                waypointsPlaceIDs += "|"
            }
            waypoints += elem.description;
            waypointsPlaceIDs += elem.place_id;
        });
        if (waypoints !== "&waypoints=") {
            query += sanitizeInput(waypoints);
        }
        if (waypointsPlaceIDs !== "&waypoint_place_ids="){
            query += sanitizeInput(waypointsPlaceIDs);
        }
    }
    query += "&travelmode="+travelModeFromMapMode(mode)
    return query;
}

let travelModeFromMapMode = function (mapMode) {
    switch (mapMode) {
        case "bus":
            return "transit";
        case "walk":
            return "walking";
        case "bike":
            return "bicycling";
        case "plane":
            return "flying";
        case "car":
        default:
            return "driving";
    }
}