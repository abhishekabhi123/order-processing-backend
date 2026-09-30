const MAX_SERIALIZATION_ATTEMPTS = 3;
const BASE_BACKOFF_MS = 25;
const MAX_JITTER_MS = 25;

export const isPrismaSerializationFailure = (error: unknown): boolean => {
    return typeof error === "object"
        && error !== null
        && "code" in error
        && error.code === "P2034";
};

const wait = (milliseconds: number) => new Promise<void>((resolve) => {
    setTimeout(resolve, milliseconds);
});

export const withSerializationRetry = async <T>(operation: () => Promise<T>): Promise<T> => {
    for (let attempt = 1; attempt <= MAX_SERIALIZATION_ATTEMPTS; attempt += 1) {
        try {
            return await operation();
        } catch (error) {
            if (!isPrismaSerializationFailure(error) || attempt === MAX_SERIALIZATION_ATTEMPTS) {
                throw error;
            }

            const backoff = BASE_BACKOFF_MS * attempt;
            const jitter = Math.floor(Math.random() * (MAX_JITTER_MS + 1));
            await wait(backoff + jitter);
        }
    }

    throw new Error("Unreachable retry state");
};
