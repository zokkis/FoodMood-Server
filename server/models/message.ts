export interface Message {
	messageId: number;
	senderId: number;
	receiverId: number;
	message: string;
	edited?: boolean;
}