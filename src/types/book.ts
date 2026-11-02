
import { ObjectId } from "mongodb";

export interface Book {
  _id?: ObjectId;
  title: string;
  author: string;
  category: string;
  description: string;
  image: string;
  totalCopies: number;
  availableCopies: number;
  addedBy: string;
  createdAt: Date;
  updatedAt: Date;
}
