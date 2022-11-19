import { sanitizeInput } from "../../service/utils.js";

let t = TrelloPowerUp.iframe();
var Promise = TrelloPowerUp.Promise;
let googleMapIframe = document.getElementById('google_map_iframe');
let locationSectionWrapper = document.getElementById('location_section_wrapper');
let locationSectionHeaderButton = document.getElementById('location_section_header_button');

let hideLocationSection = function() {
    locationSectionWrapper.style.display = 'none';
};

let showLocationSection = function() {
    locationSectionWrapper.style.display = 'block';
}

export const renderLocationSection = function(){
    return new Promise(function(resolve) {
        if (googleMapIframe == null) {
            hideLocationSection();
            resolve();
            return;
        }
        t.get('card', 'shared', 'map_enabled')
            .then(function (enabled) {
                if (!enabled) {
                    hideLocationSection();
                    resolve();
                    return;
                } else {
                    showLocationSection();
                }
                t.get('board', 'shared', 'google_api_key')
                    .then(function (googleMapAPIKey) {
                        if (googleMapAPIKey === undefined) {
                            resolve();
                            return;
                        }
                        t.get('card', 'shared', 'map_satellite_view')
                            .then(function (showSatelliteView) {
                                if (showSatelliteView === undefined) {
                                    showSatelliteView = false;
                                }
                                t.get('card', 'shared', 'map_navigation_mode')
                                    .then(function (mode) {
                                        t.get('card', 'shared', 'map_origin')
                                            .then(function (origin) {

                                                // required for all map type, leave if missing
                                                if (selectLocationIdentifier(origin) === "") {
                                                    hideLocationSection();
                                                    resolve();
                                                    return;
                                                }

                                                switch (mode) {
                                                    case "car":
                                                    case "bus":
                                                    case "walk":
                                                    case "plane":
                                                    case "bike":
                                                        t.get('card', 'shared', 'map_destination')
                                                            .then(function (destination) {

                                                                // leave if destination is missing
                                                                if (selectLocationIdentifier(destination) === "") {
                                                                    hideLocationSection();
                                                                    resolve();
                                                                    return;
                                                                }

                                                                t.get('card', 'shared', 'map_stops')
                                                                    .then(function (stops) {

                                                                        let query = "origin=" + sanitizeInput(selectLocationIdentifier(origin));
                                                                        query += "&destination=" + sanitizeInput(selectLocationIdentifier(destination));
                                                                        query += "&mode=" + directionsModeFromMapMode(mode);

                                                                        if (stops !== undefined && !isNaN(stops.length) && stops.length > 0) {
                                                                            let waypoints = "&waypoints=";
                                                                            stops.forEach((elem, i) => {
                                                                                if (i >= 20) {
                                                                                    return;
                                                                                }
                                                                                if (selectLocationIdentifier(elem) === "") {
                                                                                    return;
                                                                                }
                                                                                if (i > 0) {
                                                                                    waypoints += "|"
                                                                                }
                                                                                waypoints += sanitizeInput(selectLocationIdentifier(elem))
                                                                            });
                                                                            if (waypoints !== "&waypoints=") {
                                                                                query += waypoints;
                                                                            }
                                                                        }
                                                                        let directionSrc = buildGoogleMapSrc(
                                                                            "directions",
                                                                            googleMapAPIKey,
                                                                            query,
                                                                            showSatelliteView,
                                                                        );
                                                                        if (directionSrc !== googleMapIframe.src) {
                                                                            googleMapIframe.src = directionSrc
                                                                        }
                                                                        resolve();
                                                                    });
                                                            });
                                                        break;
                                                    case "search":
                                                        let searchSrc = buildGoogleMapSrc(
                                                            "search",
                                                            googleMapAPIKey,
                                                            "q=" + sanitizeInput(origin.description),
                                                            showSatelliteView,
                                                        );
                                                        if (searchSrc !== googleMapIframe.src) {
                                                            googleMapIframe.src = searchSrc
                                                        }
                                                        break;
                                                    case "place":
                                                    default:
                                                        let placeSrc = buildGoogleMapSrc(
                                                            "place",
                                                            googleMapAPIKey,
                                                            "q=" + sanitizeInput(selectLocationIdentifier(origin)),
                                                            showSatelliteView,
                                                        );
                                                        if (placeSrc !== googleMapIframe.src) {
                                                            googleMapIframe.src = placeSrc
                                                        }
                                                        break;
                                                }
                                                resolve();
                                            });
                                    });
                            });
                    })
            });
    });
};

let buildGoogleMapSrc = function (googleMapType, googleMapAPIKey, googleMapQuery, showSatelliteView) {
    let maptype = "";
    if (showSatelliteView) {
        maptype = "&maptype=satellite";
    }
    return `https://www.google.com/maps/embed/v1/${googleMapType}?key=${googleMapAPIKey}&${googleMapQuery}${maptype}`
}

let selectLocationIdentifier = function (elem) {
    if (elem === undefined || elem.description === undefined) {
        return "";
    }
    if (elem.place_id !== undefined && elem.place_id !== "") {
        return "place_id:"+elem.place_id;
    }
    return elem.description
}

let directionsModeFromMapMode = function (mapMode) {
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

locationSectionHeaderButton.addEventListener('click', function(evt) {
    t.popup({
        title: 'Location',
        url: '../location/location-card-form.html',
        height: 264,
        mouseEvent: evt,
    });
});