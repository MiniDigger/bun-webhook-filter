import {CreateEvent, PushEvent, User, WebhookEvent} from "@octokit/webhooks-types";

const target = "http://localhost:1337/mock-target";

export default {
    port: 1337,
    async fetch(request: Request) {
        if (request.url === "http://localhost:1337/mock-target") return;
        if (request.method !== "POST") return;
        if (!request.headers.get("X-GitHub-Event")) return;
        const eventType = request.headers.get("X-GitHub-Event") || "dum";
        const event = await request.json() as WebhookEvent;

        console.log("▶️Incoming " + eventType);
        const response = shouldForward(eventType, event)
        if (!response) {
            return await forward(request, target, event);
        } else {
            console.log("⛔ Not forwarding: " + response);
            return new Response("Not forwarding: " + response);
        }
    },
};

function shouldForward(eventType: string, event: WebhookEvent): string | null {
    let reason: string | null = null;
    if (isPush(eventType, event) || isCreate(eventType, event)) {
        reason = validSender(event.sender);
    }
    return reason;
}

function validSender(sender: User) {
    if (sender.login.includes("[bot]") || sender.login.endsWith("-bot")) {
        return "because sender is a bot (" + sender.login + ")";
    }
    return null;
}

async function forward(request: Request, target: string, event: WebhookEvent): Promise<Response> {
    try {
        console.log("🆗 Forwarding to", target);
        const body = JSON.stringify(event);

        const headers: Record<string, string> = {
            "content-type": "application/json",
        };
        for (const [key, value] of Object.entries(request.headers)) {
            if (
                typeof value === "string" &&
                (key.includes("github") ||
                    key.includes("user-agent") ||
                    key.includes("authorization"))
            ) {
                headers[key] = value;
            }
        }
        const result = await fetch(target, {
            headers,
            body,
            method: request.method,
        });

        if (result.ok) {
            console.log("✅ Forwarded");
            return new Response("Forwarded");
        }
        console.error("❌ Failed to forward:", result.status);
        return new Response("Failed to forward: " + result.status, {status: 502});
    } catch (err) {
        console.error("❌ Failed to forward:", err);
        return new Response("Failed to forward: " + err, {status: 502});
    }
}

function isPush(eventType: string, event: WebhookEvent): event is PushEvent {
    return eventType === "push";
}

function isCreate(eventType: string, event: WebhookEvent): event is CreateEvent {
    return eventType === "create";
}
