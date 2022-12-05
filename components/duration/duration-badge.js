import { getDurationButton } from "./duration-button.js";

export const getDurationDetailBadge = function(t) {
    return new Promise(function(resolve) {
        t.get('card', 'shared', 'duration')
            .then(function(duration) {
                // add duration badge
                if (duration !== undefined && duration.value > 0) {
                    resolve({
                        title: "Duration",
                        text: duration.name,
                        callback: getDurationButton,
                    });
                } else {
                    resolve(null);
                }
            });
    });
};

export const getDurationBadge = function(t) {
    return new Promise(function(resolve) {
        t.get('card', 'shared', 'duration')
            .then(function (duration) {
                if (duration !== undefined && duration.value > 0) {
                    resolve({
                        text: duration.name.replace().replaceAll(" minutes", "min").replaceAll(" hour", "h").replaceAll(" hours", "h"),
                        icon: './svg/clock-regular.svg',
                        color: null,
                    });
                } else {
                    resolve(null);
                }
            });
    });
};