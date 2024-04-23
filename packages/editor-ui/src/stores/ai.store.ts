import { defineStore } from 'pinia';
import * as aiApi from '@/api/ai';
import type { DebugErrorPayload, DebugChatPayload } from '@/api/ai';
import { useRootStore } from '@/stores/n8nRoot.store';
import { useSettingsStore } from '@/stores/settings.store';
import { chatEventBus } from '@n8n/chat/event-buses';
import type { ChatMessage } from '@n8n/chat/types';
import { computed, ref } from 'vue';
import { jsonParse, type IUser, type NodeError } from 'n8n-workflow';
import { useUsersStore } from './users.store';

export const useAIStore = defineStore('ai', () => {
	const rootStore = useRootStore();
	const settingsStore = useSettingsStore();
	const currentSessionId = ref<string>('Whatever');
	const waitingForResponse = ref(false);
	const chatTitle = ref('');

	const initialMessages = ref<ChatMessage[]>([
		{
			id: '1',
			type: 'component',
			key: 'MessageWithActions',
			sender: 'bot',
			createdAt: new Date().toISOString(),
			arguments: {
				message: 'Hello, I am a bot. How can I help you?',
				actions: [
					{ label: 'Fix issues', action: 'fix_issues' },
					{ label: 'Generate node', action: 'generate_node' },
				],
				onActionSelected({ action, label }: { action: string; label: string }) {
					// console.log('🚀 ~ onActionSelected ~ action:', action);
					void sendMessage(label);
				},
			},
		},
	]);

	const messages = ref<ChatMessage[]>([
		{
			id: '2',
			type: 'component',
			key: 'QuickReplies',
			sender: 'user',
			createdAt: new Date().toISOString(),
			transparent: true,
			arguments: {
				suggestions: [
					{ label: 'Give me more suggestions', key: 'get_more' },
					{ label: 'Ask a question about my node issues', key: 'ask_question' },
				],
				onReplySelected: ({ label, key }: { key: string; label: string }) => {
					messages.value = messages.value.filter(
						(message) => message.type !== 'component' || message.key !== 'QuickReplies',
					);
					void sendMessage(label);
				},
			},
		},
	]);

	async function sendMessage(text: string) {
		messages.value.push({
			createdAt: new Date().toISOString(),
			text,
			sender: 'user',
			id: Math.random().toString(),
		});

		chatEventBus.emit('scrollToBottom');

		void debugChat({ error: new Error('Whatever'), text, sessionId: currentSessionId.value });
	}

	const isErrorDebuggingEnabled = computed(() => settingsStore.settings.ai.errorDebugging);

	async function debugError(payload: DebugErrorPayload) {
		return await aiApi.debugError(rootStore.getRestApiContext, payload);
	}
	function getLastMessage() {
		return messages.value[messages.value.length - 1];
	}
	function onMessageReceived(messageChunk: string) {
		waitingForResponse.value = false;
		if (messageChunk.length === 0) return;
		if (messageChunk === '__END__') return;

		if (getLastMessage()?.sender !== 'bot') {
			messages.value.push({
				createdAt: new Date().toISOString(),
				text: messageChunk,
				sender: 'bot',
				type: 'text',
				id: Math.random().toString(),
			});
			return;
		}

		const lastMessage = getLastMessage();

		if (lastMessage.type === 'text') {
			lastMessage.text += messageChunk.replaceAll('\\n', '\n');
			chatEventBus.emit('scrollToBottom');
		}
	}
	function onMessageSuggestionReceived(messageChunk: string) {
		waitingForResponse.value = false;
		if (messageChunk.length === 0) return;
		if (messageChunk === '__END__') return;

		const parsedMessage = jsonParse<Record<string, unknown>>(messageChunk);
		if (getLastMessage()?.sender !== 'bot') {
			messages.value.push({
				createdAt: new Date().toISOString(),
				sender: 'bot',
				key: 'MessageWithSuggestions',
				type: 'component',
				id: Math.random().toString(),
				arguments: {
					...parsedMessage,
				},
			});
			return;
		}

		const lastMessage = getLastMessage();

		if (lastMessage.type === 'component') {
			lastMessage.arguments = parsedMessage;
			chatEventBus.emit('scrollToBottom');
		}
	}

	async function debugChat(payload: DebugChatPayload) {
		waitingForResponse.value = true;
		return await aiApi.debugChat(rootStore.getRestApiContext, payload, onMessageReceived);
	}

	async function startNewDebugSession(error: NodeError) {
		const usersStore = useUsersStore();
		const currentUser = usersStore.currentUser ?? ({} as IUser);

		messages.value = [];
		currentSessionId.value = `${currentUser.id}-${error.node.id}`;
		chatTitle.value = error.message;
		chatEventBus.emit('open');

		return await aiApi.debugChat(
			rootStore.getRestApiContext,
			{ text: JSON.stringify(error), sessionId: currentSessionId.value },
			onMessageSuggestionReceived,
		);
		// currentSessionId.value = sessionId;
	}
	return {
		debugError,
		startNewDebugSession,
		sendMessage,
		chatTitle,
		isErrorDebuggingEnabled,
		messages,
		initialMessages,
		waitingForResponse,
	};
});
