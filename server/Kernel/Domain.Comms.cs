namespace Atlas.Api;

// ============================================================================
//  Comms domain — notifications, subscriptions, news, activity feed.
//  (Split out of the former monolithic Domain.cs — same namespace.)
// ============================================================================

public class NewsBlock
{
    public int Id { get; set; }
    public string Kind { get; set; } = "headline"; // headline|highlight|shoutout|image|milestone|doc
    public string Title { get; set; } = "";
    public string Body { get; set; } = "";
    public string Metric { get; set; } = "";
    public string Label { get; set; } = "";
    public string Tone { get; set; } = "good";
    public string Who { get; set; } = "";
    public string Caption { get; set; } = "";
    public string Date { get; set; } = "";
    public string Meta { get; set; } = "";
    public int Ord { get; set; }
}

// Simple operator settings (key → value), e.g. the integration/backup toggles.

public class Subscription
{
    public int Id { get; set; }
    public string UserKey { get; set; } = default!;
    public string Email { get; set; } = "";             // captured at subscribe time (for email delivery)
    public string TargetType { get; set; } = default!;  // project|program|product
    public string TargetId { get; set; } = default!;
    public DateTime CreatedAt { get; set; }
}

// A per-user, per-event-type channel choice. Absent → the role-aware default
// (Notifications.DefaultPref) applies, so the system works before anyone opts in.

public class NotificationPref
{
    public int Id { get; set; }
    public string UserKey { get; set; } = default!;
    public string EmailAddr { get; set; } = "";         // captured at pref-set time (for email delivery)
    public string EventType { get; set; } = default!;   // risk|date_slip|status_change|approval|created
    public bool InApp { get; set; } = true;
    public bool Email { get; set; }
}

// An in-app notification in a user's inbox. Email delivery (when the user's pref
// asks for it and Graph Mail.Send is configured) is fired at emit time; this row
// is the durable in-app copy and drives the bell's unread count.

public class Notification
{
    public int Id { get; set; }
    public string UserKey { get; set; } = default!;
    public string EventType { get; set; } = default!;
    public string Title { get; set; } = default!;
    public string Body { get; set; } = "";
    public string TargetType { get; set; } = "";
    public string TargetId { get; set; } = "";
    public bool Read { get; set; }
    public DateTime At { get; set; }
}

// A per-project override of the methodology's default "ways of working". Absent
// → the project shows the methodology default (see WaysOfWorking.For). Present →
// the edited cadence/summary/ceremonies/artifacts/roles. Lists are stored as
// simple serialised text to keep the model flat.

public class ActivityEvent
{
    public int Id { get; set; }
    public int Ord { get; set; }
    public string Who { get; set; } = default!;
    public string Action { get; set; } = default!;
    public string Time { get; set; } = default!;
    public string Initials { get; set; } = default!;
    public string Color { get; set; } = default!;
}
