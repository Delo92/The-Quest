import "./_group.css";

const accent = "#FF0E9B";
const summary = `Chronic Cuties Quest for Hawaiʻi is looking for dynamic, confident women ready to represent Hawaiʻi.

Model entry is $10. Each Model/Contestant profiles may include up to 10 photos and 3 videos.

**Share your profile at least once each week.

Supporters receive one free vote per day, with additional vote blocks available for purchase. All votes are subject to verification under the official rules.

The highest-voted eligible contestant wins a 4-day, 3-night trip to the 2027 Hawaiʻi Cannabis Expo, including airfare, hotel, and ground transportation; a modeling spot in the Expo fashion show; and an opportunity to serve as a brand ambassador at the ChronicTV booth.

Voting closes December 21, 2026. The winner will be announced December 25, 2026.`;

export function Current() {
  return (
    <main
      className="min-h-screen px-4 pb-12 pt-10 sm:px-6"
      style={{
        background: `
          radial-gradient(ellipse 90% 35% at 50% 0%, ${accent}18 0%, transparent 65%),
          radial-gradient(ellipse 50% 25% at 10% 40%, ${accent}0d 0%, transparent 55%),
          linear-gradient(180deg, #0d0008 0%, #060006 40%, #040004 70%, #000 100%)
        `,
      }}
    >
      <div className="mx-auto max-w-5xl">
        <p
          className="mb-8 max-w-3xl leading-8"
          style={{ color: "rgba(255,255,255,0.45)", fontStyle: "italic", fontWeight: 300, fontSize: "1rem" }}
          data-testid="text-description"
        >
          {summary}
        </p>
      </div>
    </main>
  );
}
