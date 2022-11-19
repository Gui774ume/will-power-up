let pollSectionHasSomethingToShow = function(t) {
    return new Promise(function(resolve) {
        t.get('card', 'shared', 'polls')
            .then(function(polls) {
                resolve(polls !== undefined && polls.length > 0);
            });
    });
}

let locationSectionHasSomethingToShow = function(t) {
    return new Promise(function(resolve) {
        t.get('card', 'shared', 'map_enabled')
            .then(function(enabled) {
                resolve(enabled);
            });
    });
}

export const shouldShowCardSection = function(t) {
    return new Promise(function(resolve) {
        locationSectionHasSomethingToShow(t)
            .then(function(yes) {
                if (yes) {
                    resolve(true);
                } else {
                    pollSectionHasSomethingToShow(t)
                        .then(function(yes) {
                            if (yes) {
                                resolve(true);
                            } else {
                                resolve(null);
                            }
                        });
                }
            })
    });
}