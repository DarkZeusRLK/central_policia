import { MongoClient } from "mongodb";

let client;
let clientPromise;

function getDbNameFromUri(uri) {
  try {
    const parsed = new URL(uri);
    const pathname = parsed.pathname.replace(/^\//, "").trim();
    return pathname || "";
  } catch {
    return "";
  }
}

export async function getMongoDatabase() {
  const uri = process.env.MONGODB_URI;

  if (!uri) {
    throw new Error("A variável de ambiente MONGODB_URI não foi configurada.");
  }

  if (!clientPromise) {
    client = new MongoClient(uri, {
      maxPoolSize: 10,
      minPoolSize: 0,
      retryReads: true,
    });

    clientPromise = client.connect();
  }

  const connectedClient = await clientPromise;
  const dbName = process.env.MONGODB_DB || getDbNameFromUri(uri);

  if (!dbName) {
    throw new Error(
      "Não foi possível determinar o banco a partir de MONGODB_URI. Informe MONGODB_DB ou inclua o nome do banco na URI.",
    );
  }

  return connectedClient.db(dbName);
}

