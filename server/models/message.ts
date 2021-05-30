interface IDBInsertMessage {
	senderId: number;
	receiverId: number;
	message: string;
	edited?: boolean;
}

interface IMessage {
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

	public static getForDB(message: Message | IMessage): IDBInsertMessage {
		return {
			senderId: message.senderId,
			receiverId: message.receiverId,
			message: message.message,
			edited: !!message.edited
		};
	}
}