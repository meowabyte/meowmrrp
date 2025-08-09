/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import "./style.css";

import { addMessagePreSendListener, removeMessagePreSendListener } from "@api/MessageEvents";
import { definePluginSettings } from "@api/Settings";
import { ErrorBoundary } from "@components/index";
import { getCurrentChannel, sendMessage } from "@utils/discord";
import { Margins } from "@utils/margins";
import { classes } from "@utils/misc";
import definePlugin, { OptionType } from "@utils/types";
import { findByPropsLazy, findComponentByCodeLazy } from "@webpack";
import { Card, FluxDispatcher, Forms, GuildStore, IconUtils, MessageStore, ScrollerThin, TextInput, Tooltip, useCallback, useMemo, UserStore, useState } from "@webpack/common";

import type { ChatEmojiProps, InputTagsClassesProps, InputWithTagsProps, Message } from "./types";

const ChatEmoji = findComponentByCodeLazy<ChatEmojiProps>("isInteracting:", "tooltipPosition:", "enableClick:", "channelId:", "messageId:");
const BlobCatCozy = () =>
    <ErrorBoundary noop>
        <ChatEmoji
            isInteracting={false}
            channelId="1015060231060983891"
            messageId="0"
            enableClick={false}
            tooltipPosition="top"
            node={{
                emojiId: "1026533070955872337",
                name: ":blobcatcozy:",
                animated: false,
                type: "customEmoji",
                jumboable: false
            }}
        />
    </ErrorBoundary>;
const InputWithTags = findComponentByCodeLazy<InputWithTagsProps>("onRemoveTag", "onQueryChange", "useKeyboardNavigation");
const InputTagsClasses = findByPropsLazy("richTag", "richTagInput", "tagLabel", "tagRoleColor") as InputTagsClassesProps;

let isCurrentlyActive = false;
const unsetIsActive = () => { isCurrentlyActive = false; };
const setIsActive = () => { isCurrentlyActive = true; };

let interv: number | null = null;

const DEFAULT_RANDOM_PHRASES = ["meow", "mrrp", "mrrow", "mrow", "mrrrrp", "mewo"];
const ALLOWED_DELAYS = [5, 10, 20, 30, 40, 50, 60];


const settings = definePluginSettings({
    notif1: {
        type: OptionType.COMPONENT,
        component: () => <Card className={classes("vc-settings-card", "vc-backup-restore-card")}>
            <span>
                This plugin triggers <b>ONLY</b> when no messages were sent in past <code>delay * 2</code> and if last message was not from a plugin to prevent spam!
                I don't care if you like it or not, I don't want to be hated for making spam plugin. <BlobCatCozy />
            </span>
        </Card>
    },
    delay: {
        type: OptionType.SLIDER,
        default: 10,
        description: "Delay (in minutes) how often you will meow on current channel.",
        restartNeeded: true,
        markers: ALLOWED_DELAYS
    },
    phrases: {
        type: OptionType.COMPONENT,
        default: DEFAULT_RANDOM_PHRASES,
        component: () => {
            const [query, setQuery] = useState("");

            const onRemoveTag = useCallback((i: number) => {
                settings.store.phrases.splice(i, 1);
            }, [settings.store.phrases]);

            const onQueryChange = useCallback((q: string) => {
                q = q.trim();

                if (q.endsWith(",")) {
                    settings.store.phrases.push(q.slice(0, -1));
                    setQuery("");
                    return;
                }

                setQuery(q);
            }, []);

            return <Forms.FormSection>
                <Forms.FormTitle >Phrases</Forms.FormTitle>
                <Forms.FormText className={Margins.bottom20}>Phrases to use.</Forms.FormText>
                <InputWithTags
                    placeholder="eg. meow, mrrp, mrrow"
                    size={InputTagsClasses.medium}
                    tags={settings.store.phrases}
                    query={query}
                    onQueryChange={onQueryChange}
                    onRemoveTag={onRemoveTag} />
            </Forms.FormSection>;
        }
    },
    serverBlacklist: {
        type: OptionType.COMPONENT,
        description: "Server IDs that are blacklisted from this plugin. (separated by colon)",
        default: [] as string[],
        component: () => {
            const [query, setQuery] = useState("");

            const guilds = useMemo(
                () => {
                    const list = Object.values(GuildStore.getGuilds())
                        .toSorted(g => settings.store.serverBlacklist.includes(g.id) ? -1 : 1);

                    if (query.length === 0) return list;

                    const idMode = /^\d+$/.test(query);
                    return list.filter(g => idMode ? g.id.includes(query) : g.name.toLowerCase().includes(query.toLowerCase()));
                },
                [settings.store.serverBlacklist, query]
            );

            const toggleGuild = useCallback((id: string) => {
                const pos = settings.store.serverBlacklist.findIndex(x => x === id);

                if (pos > -1) settings.store.serverBlacklist.splice(pos, 1);
                else settings.store.serverBlacklist.push(id);
            }, [settings.store.serverBlacklist]);

            return <Forms.FormSection>
                <Forms.FormTitle >Server Blacklist</Forms.FormTitle>
                <Forms.FormText className={Margins.bottom20}>Servers that this plugin will ignore.</Forms.FormText>
                <TextInput onChange={setQuery} placeholder="Search for server/ID" />
                <ScrollerThin className="mm-serverpicker">
                    {guilds.map(g => {
                        const selected = settings.store.serverBlacklist.includes(g.id);

                        return (
                            <Tooltip key={g.id} text={`${selected ? "❌ " : ""}${g.name}`}>
                                {tooltipProps => (
                                    <div className="mm-serverpicker-icon-wrapper">
                                        <img {...tooltipProps} loading="lazy" onClick={() => toggleGuild(g.id)} className="mm-serverpicker-icon" src={IconUtils.getGuildIconURL({ id: g.id, icon: g.icon, size: 60, canAnimate: true })} height={60} />
                                        {selected && <div className="mm-serverpicker-icon-overlay" />}
                                    </div>
                                )}
                            </Tooltip>
                        );
                    })}
                </ScrollerThin>
            </Forms.FormSection>;
        }
    },
    activeOnly: {
        type: OptionType.BOOLEAN,
        description: "Should the plugin be only triggered when you sent something there in active session? (on channel switch)",
        default: true,
        restartNeeded: true
    }
});

export default definePlugin({
    name: "meowmrrp",
    description: "Randomly meow or mrrp on the chat. (with sensible delay)",
    authors: [{ id: 105170831130234880n, name: "kb" }],
    settings,

    getPhrases() {
        if (this.settings.store.phrases.length === 0) this.settings.store.phrases = DEFAULT_RANDOM_PHRASES;
        return this.settings.store.phrases;
    },

    get delay(): number { return this.settings.store.delay; },

    getRandomPhrase() {
        const phrases = this.getPhrases();
        return phrases[Math.floor(Math.random() * phrases.length)];
    },

    getBlacklist() {
        return this.settings.store.serverBlacklist;
    },

    sendMeow() {
        const ch = getCurrentChannel();
        if (!ch) return;

        const { id, guild_id } = ch;
        if (this.getBlacklist().includes(guild_id)) return;
        if (this.settings.store.activeOnly && !isCurrentlyActive) return;

        const lastMsg: Message | undefined = MessageStore.getMessages(id).last();

        if (
            lastMsg
            && (
                ( // author is user & includes phrase
                    lastMsg.author.id === UserStore.getCurrentUser().id
                    && lastMsg.content
                    && this.getPhrases().includes(lastMsg.content)
                )
                // last message was delay*2 ago
                || (Date.now() - lastMsg.timestamp.getTime()) < (this.delay * 60_000) * 2
            )
        ) return;

        sendMessage(ch.id, {
            content: this.getRandomPhrase()
        });
    },

    start() {
        if (typeof (this.settings.store.phrases as string | string[]) === "string") (this.settings.store.phrases as unknown as string).split(",").map(p => p.trim());
        if (typeof (this.settings.store.serverBlacklist as string | string[]) === "string") (this.settings.store.serverBlacklist as unknown as string).split(",").map(p => p.trim());

        if (this.delay < Math.min(...ALLOWED_DELAYS)) return; // Pls no silly, don't get muted qwq

        interv = setInterval(this.sendMeow.bind(this), this.delay * 60_000) as any;
        if (this.settings.store.activeOnly) {
            FluxDispatcher.subscribe("CHANNEL_SELECT", unsetIsActive);
            addMessagePreSendListener(setIsActive);
        }
    },

    stop() {
        if (interv) {
            clearInterval(interv);
            interv = null;
        }
        if (this.settings.store.activeOnly) {
            FluxDispatcher.unsubscribe("CHANNEL_SELECT", unsetIsActive);
            removeMessagePreSendListener(setIsActive);
        }
    },
});
