let t = TrelloPowerUp.iframe();
let googleMapIframeHeight = 400;
let googleMapIframe = document.getElementById('google_map_iframe');

t.render(function(){
    if (googleMapIframe == null) {
        t.sizeTo('#google_map');
        return;
    }
    t.get('card', 'shared', 'map_enabled')
        .then(function(enabled) {
            if (!enabled) {
                t.sizeTo(1);
                googleMapIframe.src = "";
                return;
            } else {
                t.sizeTo(googleMapIframeHeight);
            }
            t.get('board', 'shared', 'google_api_key')
                .then(function(googleMapAPIKey) {
                    if (googleMapAPIKey === undefined) {
                        return;
                    }
                    t.get('card', 'shared', 'map_satellite_view')
                        .then(function(showSatelliteView) {
                            if (showSatelliteView === undefined) {
                                showSatelliteView = false;
                            }
                            t.get('card', 'shared', 'map_navigation_mode')
                                .then(function (mode) {
                                    t.get('card', 'shared', 'map_origin')
                                        .then(function (origin) {

                                            // required for all map type, leave if missing
                                            if (selectLocationIdentifier(origin) === "") {
                                                t.sizeTo(1);
                                                googleMapIframe.src = "";
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
                                                                t.sizeTo(1);
                                                                googleMapIframe.src = "";
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
                                                                    googleMapIframe.src = buildGoogleMapSrc(
                                                                        "directions",
                                                                        googleMapAPIKey,
                                                                        query,
                                                                        showSatelliteView,
                                                                    );
                                                                });
                                                        });
                                                    break;
                                                case "search":
                                                    googleMapIframe.src = buildGoogleMapSrc(
                                                        "search",
                                                        googleMapAPIKey,
                                                        "q=" + sanitizeInput(origin.description),
                                                        showSatelliteView,
                                                    );
                                                    break;
                                                case "place":
                                                default:
                                                    googleMapIframe.src = buildGoogleMapSrc(
                                                        "place",
                                                        googleMapAPIKey,
                                                        "q=" + sanitizeInput(selectLocationIdentifier(origin)),
                                                        showSatelliteView,
                                                    );
                                                    break;
                                            }
                                        });
                                });
                        });
                })
        });
});

let sanitizeInput = function (input) {
    return input.replaceAll(' ', '%20').replaceAll('+', '%2B')
}

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