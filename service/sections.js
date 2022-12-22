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

let contactSectionHasSomethingToShow = function(t) {
    return new Promise(function(resolve) {
        t.get('card', 'shared', 'contact')
            .then(function(contact) {
                resolve(contact !== undefined);
            });
    });
}

export const shouldShowCardSection = function(t) {
    return new Promise(async function(resolve) {
        let show = false;

        await locationSectionHasSomethingToShow(t)
            .then(function(yes) {
                show = yes;
            });

        if (show) {
            resolve(true);
            return;
        }

        await contactSectionHasSomethingToShow(t)
            .then(function(yes) {
                show = yes;
            });

        if (show) {
            resolve(true);
            return;
        }

        await pollSectionHasSomethingToShow(t)
            .then(function(yes) {
                show = yes;
            });

        resolve(show);
    });
}