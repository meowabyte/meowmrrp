/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

// NOTE: This type is not accurate and should be analyzed further for other use than custom emojis
export type EmojiNode = { animated: false, emojiId: string, jumboable: boolean, name: `:${string}:`, type: "customEmoji"; };
export type Message = { id: string, timestamp: Date, author: { id: string; }, content?: string; };

export type InputTagsClassesProps = { [x in "container" | "inner" | "disabled" | "input" | "tag" | "small" | "medium" | "large" | "richTag" | "richTagInput" | "tagLabel" | "tagRoleColor" | "close" | "iconLayout" | "iconContainer" | "icon" | "visible" | "clear"]: string };

export type ChatEmojiProps = {
    node: EmojiNode,
    isInteracting: boolean,
    tooltipPosition?: string,
    enableClick?: boolean,
    channelId: string,
    messageId: string;
};
export type InputWithTagsProps = {
    query: string,
    size?: string,
    tags: string[],
    placeholder?: string,
    // onSelectionChange?: (e: unknown, t: unknown) => void,
    // onSelect?: () => void,
    onRemoveTag: (i: number) => void,
    onQueryChange: (query: string) => void,
    className?: string;
};
