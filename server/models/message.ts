export interface IMessage {
	messageId: number;
	senderId: number;
	receiverId: number;
	message: string;
	edited?: boolean;
}

export class Message implements IMessage {
	constructor(
		public messageId: number,
		public senderId: number,
		public receiverId: number,
		public message: string,
		public edited?: boolean
	) {
	}

	public static getFromJson(message: Message | IMessage): Message {
		return new Message(
			message.messageId,
			message.senderId,
			message.receiverId,
			message.message,
			!!message.edited
		);
	}
}