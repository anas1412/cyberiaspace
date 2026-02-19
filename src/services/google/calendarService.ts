/**
 * Google Calendar Service
 */

const CALENDAR_API_URL = 'https://www.googleapis.com/calendar/v3';

export const calendarService = {
  upsertEvent: async (token: string, eventId: string | undefined | null, details: { title: string, date: string, thoughtId: number }) => {
    const event = {
      summary: details.title,
      description: `Cyberia Thought ID: ${details.thoughtId}\nView in Cyberia: https://cyberia.app`,
      start: { date: details.date },
      end: { date: details.date },
      extendedProperties: {
        private: {
          thoughtId: details.thoughtId.toString()
        }
      }
    };

    const url = eventId 
      ? `${CALENDAR_API_URL}/calendars/primary/events/${eventId}`
      : `${CALENDAR_API_URL}/calendars/primary/events`;
    
    const method = eventId ? 'PUT' : 'POST';

    const res = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(event)
    });

    if (!res.ok) throw new Error('Calendar Sync Failed');
    return await res.json();
  },

  deleteEvent: async (token: string, eventId: string) => {
    const response = await fetch(`${CALENDAR_API_URL}/calendars/primary/events/${eventId}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      // If event is already gone, that's fine
      if (response.status === 404) return true;
      throw new Error('Calendar Delete Failed');
    }
    return true;
  }
};
