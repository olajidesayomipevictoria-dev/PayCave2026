'use strict';

const userStates = new Map();

function setState(telegramId, state, data = {}) {

    userStates.set(String(telegramId), {

            state,

                    data

                        });

                        }

                        function getState(telegramId) {

                            return userStates.get(String(telegramId));

                            }

                            function clearState(telegramId) {

                                userStates.delete(String(telegramId));

                                }

                                module.exports = {

                                    setState,

                                        getState,

                                            clearState

                                            };