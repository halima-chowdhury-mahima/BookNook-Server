
import { ObjectId } from "mongodb";

export interface Borrow {
  _id?: ObjectId;
  bookId: ObjectId;
  userId: string;
  bookTitle: string;
  bookAuthor: string;
  bookImage: string;
  borrowedAt: Date;
  status: "active" | "returned";
  returnedAt?: Date;
}
