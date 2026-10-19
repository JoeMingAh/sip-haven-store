/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            // Garden Teahouse palette.
            // Contrast on cream: ink 10.8:1, sage-deep 6.3:1, sage 3.7:1. WCAG AA needs
            // 4.5:1 for small text, so keep `sage` for borders, icons and illustration.
            // Cream text on sage is 3.7:1 and white on sage is 4.1:1, so a bar or button
            // that carries text uses sage-deep behind cream text (6.3:1), or sage-tint /
            // wood behind ink or sage-deep text (5.1:1 or better).
            colors: {
                cream: "#F7F4EC",
                sage: "#6F8466",
                "sage-deep": "#4E5F47",
                wood: "#E9DCC8",
                "sage-tint": "#DDE5D3",
                ink: "#2F3A2E",
            },
            // Lora and Nunito Sans are loaded from Google Fonts in index.html.
            fontFamily: {
                serif: ["Lora", "ui-serif", "Georgia", "serif"],
                sans: ['"Nunito Sans"', "ui-sans-serif", "system-ui", "sans-serif"],
            },
        },
    },
    plugins: [],
}
