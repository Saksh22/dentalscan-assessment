import { EventEmitter } from "events";

type Sender = "patient" | "dentist";

export type MessagingEvent = {
  threadId: string;
  patientId: string;
  scanId: string | null;
  message: {
    id: string;
    content: string;
    sender: Sender;
    createdAt: Date;
  };
};

const MESSAGE_EVENT = "message.created";

const globalForMessagingEvents = globalThis as typeof globalThis & {
  messagingEventBus?: EventEmitter;
};

const eventBus =
  globalForMessagingEvents.messagingEventBus ??
  new EventEmitter();

eventBus.setMaxListeners(0);

if (!globalForMessagingEvents.messagingEventBus) {
  globalForMessagingEvents.messagingEventBus = eventBus;
}

export function publishMessagingEvent(event: MessagingEvent) {
  eventBus.emit(MESSAGE_EVENT, event);
}

export function subscribeToMessagingEvents(
  filter: { threadId?: string; patientId?: string; scanId?: string },
  listener: (event: MessagingEvent) => void
) {
  const wrappedListener = (event: MessagingEvent) => {
    const matchesThread = filter.threadId ? event.threadId === filter.threadId : false;
    const matchesPatient = filter.patientId ? event.patientId === filter.patientId : false;
    const matchesScan = filter.scanId ? event.scanId === filter.scanId : false;

    if (matchesThread || matchesPatient || matchesScan) {
      listener(event);
    }
  };

  eventBus.on(MESSAGE_EVENT, wrappedListener);

  return () => {
    eventBus.off(MESSAGE_EVENT, wrappedListener);
  };
}
