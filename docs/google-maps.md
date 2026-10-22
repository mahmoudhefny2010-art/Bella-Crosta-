# Google Maps setup

The checkout, address picker and order tracking use Google Maps when
`GOOGLE_MAPS_API_KEY` is configured. Until then, OpenStreetMap remains active.
Location permission, automatic location detection, draggable pins, Egypt boundary
validation and driver tracking work with either map provider.

1. Open your project in Google Cloud Console (the Google sign-in project can also
   be used). Enable billing for Google Maps Platform.
2. Under **APIs & Services > Library**, enable **Maps JavaScript API**.
3. Under **APIs & Services > Credentials**, create an **API key**. This is different
   from the Google OAuth client ID and client secret.
4. Edit the key: choose **Websites** under application restrictions, and add
   `http://localhost:4000/*` for development. Add your real HTTPS website when
   deploying. Under API restrictions, restrict the key to **Maps JavaScript API**.
5. Under **Google Maps Platform > Map Management**, create a **JavaScript** map ID
   for production. Development uses Google's `DEMO_MAP_ID` when no ID is supplied.
6. Add these settings to `.env`:

   ```dotenv
   GOOGLE_MAPS_API_KEY=your_browser_maps_key
   GOOGLE_MAPS_MAP_ID=your_javascript_map_id
   ```

7. Restart `npm run dev` if necessary, then refresh checkout. No Geocoding or Places
   API is required for the current pin picker.

The browser key is intentionally delivered to the frontend. Protect it with
website and API restrictions; never put an OAuth client secret in these settings.
Google's usage charges depend on your account and usage; configure budgets and
quotas in Google Cloud.

Directions opened from the driver's **Open map** link use Google Maps, even before
an API key is configured.

Official setup: https://developers.google.com/maps/documentation/javascript/get-api-key
