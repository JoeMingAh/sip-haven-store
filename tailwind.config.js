/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            // One warm tea-house scale. The oat ground, the wood panel, and the ink
            // share a hue near 80°. Sage-tint, sage, and sage-deep step from that
            // parchment toward olive (hue 105 to 128). They are not the cool mint and
            // blue-slate that were sitting on the peach ground.
            // On oat #F2D9B6: ink 9.0:1, sage-deep 7.0:1, sage 3.8:1. Sage is for
            // borders, icons, and illustration. On sage-tint it is 3.3:1 and on wood
            // 3.1:1, enough for a border and not for small text. Headings use
            // sage-deep (6.0:1 on sage-tint, 5.7:1 on wood).
            //
            // The loud 10% is rose hip #7A3044. It is a warm berry, the same warmth
            // as the oat, and it is not orange, gold, or forest green. Oat text on
            // it is 6.6:1. The button clears wood at 5.3:1 and sage-tint at 5.7:1.
            // It is only for primary actions.
            colors: {
                cream: "#F2D9B6",
                sage: "#65724E",
                "sage-deep": "#404838",
                wood: "#DCC4A0",
                "sage-tint": "#D2CFAE",
                ink: "#3A342C",
                plum: "#7A3044",
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
