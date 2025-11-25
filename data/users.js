import bcrypt from "bcrypt";
import { ObjectId } from "mongodb";
import { users as usersCollectionFn } from "../config/mongoCollections.js";

const SALT_ROUNDS = 10;

const normalizeEmail = (email) => email.trim().toLowerCase();
const sanitizeString = (str) => str.trim();

export const createUser = async ({ firstName, lastName, email, password }) => {
  if (!firstName || !lastName || !email || !password) {
    throw new Error("All fields are required.");
  }

  firstName = sanitizeString(firstName);
  lastName = sanitizeString(lastName);
  email = normalizeEmail(email);

  if (password.length < 8) {
    throw new Error("Password must be at least 8 characters long.");
  }

  const usersCollection = await usersCollectionFn();

  const existing = await usersCollection.findOne({ email });
  if (existing) {
    throw new Error("An account with that email already exists.");
  }

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

  const insertResult = await usersCollection.insertOne({
    firstName,
    lastName,
    email,
    passwordHash,
  });

  if (!insertResult.insertedId) {
    throw new Error("Failed to create user.");
  }

  return {
    _id: insertResult.insertedId.toString(),
    firstName,
    lastName,
    email,
  };
};

export const authenticateUser = async (email, password) => {
  if (!email || !password) {
    throw new Error("Email and password are required.");
  }

  email = normalizeEmail(email);

  const usersCollection = await usersCollectionFn();
  const user = await usersCollection.findOne({ email });

  if (!user) {
    throw new Error("Invalid email or password.");
  }

  const passwordMatches = await bcrypt.compare(password, user.passwordHash);
  if (!passwordMatches) {
    throw new Error("Invalid email or password.");
  }

  return {
    _id: user._id.toString(),
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
  };
};

export const getUserById = async (id) => {
  if (!id) throw new Error("User id is required.");
  const usersCollection = await usersCollectionFn();
  const user = await usersCollection.findOne({ _id: new ObjectId(id) });
  if (!user) throw new Error("User not found.");
  return {
    _id: user._id.toString(),
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
  };
};
