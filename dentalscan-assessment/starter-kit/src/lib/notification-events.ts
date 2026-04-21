import { EventEmitter } from "events";

export type NotificationEvent = {
  id: string;
  scanId: string | null;
  read: boolean;
  title?: string;
  message?: string;
  createdAt?: Date;
};

const NOTIFICATION_EVENT = "notification.updated";

const globalForNotificationEvents = globalThis as typeof globalThis & {
  notificationEventBus?: EventEmitter;
};

const eventBus =
  globalForNotificationEvents.notificationEventBus ??
  new EventEmitter();

eventBus.setMaxListeners(0);

if (!globalForNotificationEvents.notificationEventBus) {
  globalForNotificationEvents.notificationEventBus = eventBus;
}

export function publishNotificationEvent(event: NotificationEvent) {
  eventBus.emit(NOTIFICATION_EVENT, event);
}

export function subscribeToNotificationEvents(
  filter: { notificationId?: string; scanId?: string },
  listener: (event: NotificationEvent) => void
) {
  const wrappedListener = (event: NotificationEvent) => {
    const matchesNotification = filter.notificationId
      ? event.id === filter.notificationId
      : false;
    const matchesScan = filter.scanId ? event.scanId === filter.scanId : false;

    if (matchesNotification || matchesScan) {
      listener(event);
    }
  };

  eventBus.on(NOTIFICATION_EVENT, wrappedListener);

  return () => {
    eventBus.off(NOTIFICATION_EVENT, wrappedListener);
  };
}
