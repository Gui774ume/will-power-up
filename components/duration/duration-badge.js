import { getDurationButton } from "./duration-button.js";

export const getDurationBadge = function(t) {
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