export const getDurationButton = function(t, options) {
    return t.popup({
        title: 'Task duration',
        items: function(t, options) {
            return new Promise(async function(resolve) {
                let durations = [
                    {
                        name: "Remove duration",
                        value: 0,
                    },
                    {
                        name: "15 minutes",
                        value: 15,
                    },
                    {
                        name: "30 minutes",
                        value: 30,
                    },
                    {
                        name: "45 minutes",
                        value: 45,
                    },
                    {
                        name: "1 hour",
                        value: 60,
                    },
                    {
                        name: "1 hour 30 minutes",
                        value: 90,
                    },
                    {
                        name: "2 hours",
                        value: 120,
                    },
                    {
                        name: "3 hours",
                        value: 180,
                    },
                    {
                        name: "6 hours",
                        value: 360,
                    }
                ];
                let items = [];

                // add the current choice
                await t.get('card', 'shared', 'duration')
                    .then(function(duration) {
                        if (duration !== undefined && duration.value > 0) {
                            items.push({
                                text: `Keep '${duration.name}'`,
                                callback: async function(t, opt) {
                                    await t.closePopup()
                                },
                            });
                        }
                    });

                durations.forEach(function(duration) {
                    items.push({
                        text: duration.name,
                        callback: async function (t, opt) {
                            await t.set('card', 'shared', 'duration', duration)
                                .then(function() {
                                    t.closePopup();
                                });
                        },
                    });
                });
                resolve(items);
            })
        },
    });
};