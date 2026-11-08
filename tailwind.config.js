/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            // Garden Teahouse, shifted so it does not share a color with TBagger.
            // `cream` is rice-paper oat #F2D9B6, not TBagger's #F6F4EE (CIEDE2000 13).
            // Ink is warm charcoal #3A302A, not TBagger's black #0A0A0A (CIEDE2000 13).
            // On the oat ground: ink 9.4:1, sage-deep 6.3:1, sage 4.4:1. Sage is for
            // borders, icons and illustration. On sage-tint it is 3.9:1, still enough
            // for a border (WCAG non-text is 3:1) and not for small text. Headings use
            // sage-deep (5.7:1 on sage-tint, 4.6:1 on wood).
            //
            // The loud 10% is plum #6E2454, hibiscus rather than orange. Oat text on
            // plum is 7.5:1. The button clears wood at 5.5:1 and sage-tint at 6.7:1.
            // It is only for primary actions.
            colors: {
                cream: "#F2D9B6",
                sage: "#54685A",
                "sage-deep": "#3E4E56",
                wood: "#D8B898",
                "sage-tint": "#C9D5C0",
                ink: "#3A302A",
                plum: "#6E2454",
            },
            // Lora and Nunito Sans are self-hosted from @fontsource (see src/main.jsx).
            fontFamily: {
                serif: ["Lora", "ui-serif", "Georgia", "serif"],
                sans: ['"Nunito Sans"', "ui-sans-serif", "system-ui", "sans-serif"],
            },
            // The cart drawer fades its backdrop in and slides in from the right. Use
            // them as motion-safe:animate-fade-in / motion-safe:animate-slide-in-right
            // so nothing moves for a shopper who has asked for less motion.
            keyframes: {
                "fade-in": { from: { opacity: "0" }, to: { opacity: "1" } },
                "slide-in-right": {
                    from: { transform: "translateX(100%)" },
                    to: { transform: "translateX(0)" },
                },
            },
            animation: {
                "fade-in": "fade-in 200ms ease-out",
                "slide-in-right": "slide-in-right 250ms ease-out",
            },
        },
    },
    plugins: [],
}
