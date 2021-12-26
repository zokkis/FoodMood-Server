export interface IDBInsertMessage {
	senderId: number;
	receiverId: number;
	message: string;
	isEdited?: boolean;
}

interface IMessage {
	messageId: number;
	senderId: number;
	receiverId: number;
	message: string;
	isEdited?: boolean;
}

export class Message implements IMessage {
	constructor(
		public messageId: number,
		public senderId: number,
		public receiverId: number,
		public message: string,
		public isEdited?: boolean
	) {}

	static getForDB(message: Message | IMessage): IDBInsertMessage {
		return {
			senderId: message.senderId,
			receiverId: message.receiverId,
			message: message.message,
			isEdited: !!message.isEdited,
		};
	}
}
