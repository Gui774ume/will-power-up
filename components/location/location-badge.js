export const getSpotlightedLocation = function(t) {
    return new Promise(function(resolve) {
        t.get('card', 'shared', 'map_origin')
            .then(function (origin) {
                t.get('card', 'shared', 'map_destination')
                    .then(function (destination) {
                        t.get('card', 'shared', 'map_navigation_mode')
                            .then(function (navigationMode) {
                                // add location badge
                                if (origin !== undefined && origin.description !== '') {
                                    if (destination !== undefined && destination.description !== '' && navigationMode !== 'place' && navigationMode !== 'search') {
                                        resolve(destination);
                                    } else {
                                        resolve(origin);
                                    }
                                } else {
                                    resolve(null);
                                }
                            });
                    });
            });
    });
};

export const getLocationDetailBadge = function(t) {
    return new Promise(function(resolve) {
        getSpotlightedLocation(t)
            .then(function(location) {
                if (location !== null) {
                    if (location.description.startsWith("https://")) {
                        resolve({
                            title: "Location",
                            text: location.description,
                            url: location.description,
                        });
                    } else {
                        resolve({
                            title: "Location",
                            text: location.description,
                            callback: function (t, options) {
                                return t.popup({
                                    title: 'Location',
                                    url: './components/location/location-card-form.html',
                                    height: 264,
                                });
                            },
                        });
                    }
                } else {
                    resolve(null);
                }
            });
    });
};

export const getLocationBadge = function(t) {
    return new Promise(function(resolve) {
        t.get('card', 'shared', 'map_origin')
            .then(function(origin) {
                if (origin !== undefined && origin.description !== '') {
                    resolve({
                        text: "",
                        icon: './svg/map-location-dot-solid.svg',
                        color: null,
                    });
                } else {
                    resolve(null);
                }
            });
        });
};