"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { motion } from "motion/react";
import { cn } from "../../lib/utils";

interface LetterState {
    char: string;
    isMatrix: boolean;
    isSpace: boolean;
}

interface MatrixTextProps {
    text?: string;
    className?: string;
    initialDelay?: number;
    letterAnimationDuration?: number;
    letterInterval?: number;
}

export const MatrixText = ({
    text = "HelloWorld!",
    className,
    initialDelay = 200,
    letterAnimationDuration = 500,
    letterInterval = 100,
}: MatrixTextProps) => {
    const [letters, setLetters] = useState<LetterState[]>(() =>
        text.split("").map((char) => ({
            char,
            isMatrix: false,
            isSpace: char === " ",
        }))
    );
    const [isAnimating, setIsAnimating] = useState(false);
    const hasAnimatedRef = useRef(false);

    const getRandomChar = useCallback(
        () => (Math.random() > 0.5 ? "1" : "0"),
        []
    );

    const animateLetter = useCallback(
        (index: number) => {
            if (index >= text.length) return;

            requestAnimationFrame(() => {
                setLetters((prev) => {
                    const newLetters = [...prev];
                    if (!newLetters[index].isSpace) {
                        newLetters[index] = {
                            ...newLetters[index],
                            char: getRandomChar(),
                            isMatrix: true,
                        };
                    }
                    return newLetters;
                });

                setTimeout(() => {
                    setLetters((prev) => {
                        const newLetters = [...prev];
                        newLetters[index] = {
                            ...newLetters[index],
                            char: text[index],
                            isMatrix: false,
                        };
                        return newLetters;
                    });
                }, letterAnimationDuration);
            });
        },
        [getRandomChar, text, letterAnimationDuration]
    );

    const startAnimation = useCallback(() => {
        if (isAnimating) return;

        setIsAnimating(true);
        let currentIndex = 0;

        const animate = () => {
            if (currentIndex >= text.length) {
                setIsAnimating(false);
                return;
            }

            animateLetter(currentIndex);
            currentIndex++;
            setTimeout(animate, letterInterval);
        };

        animate();
    }, [animateLetter, text, isAnimating, letterInterval]);

    useEffect(() => {
        if (hasAnimatedRef.current) return;
        hasAnimatedRef.current = true;

        const timer = setTimeout(startAnimation, initialDelay);
        return () => clearTimeout(timer);
    }, [initialDelay, startAnimation]);

    const motionVariants = useMemo(
        () => ({
            matrix: {
                color: "#00FFD5",
                textShadow: "0 0 12px rgba(0, 255, 213, 0.95), 0 0 28px rgba(0, 229, 255, 0.48)",
            },
            normal: {
                color: "#ffffff",
                textShadow: "0 0 18px rgba(125, 249, 255, 0.28), 0 0 36px rgba(31, 81, 255, 0.2)",
            }
        }),
        []
    );

    return (
        <div
            className={cn(
                "inline-flex items-center justify-center text-white",
                className
            )}
            aria-label="Matrix text animation"
        >
            <div className={cn(
                "flex items-center justify-center",
                className?.includes("flex-nowrap") ? "flex-nowrap" : "flex-wrap"
            )}>
                {letters.map((letter, index) => (
                    <motion.div
                        key={`${index}-${letter.char}`}
                        className="text-center"
                        initial="initial"
                        animate={letter.isMatrix ? "matrix" : "normal"}
                        variants={motionVariants}
                        transition={{
                            duration: 0.1,
                            ease: "easeInOut",
                        }}
                        style={{
                            display: "inline-block",
                            fontVariantNumeric: "tabular-nums",
                            minWidth: letter.isSpace ? "0.25em" : "auto",
                        }}
                    >
                        {letter.isSpace ? "\u00A0" : letter.char}
                    </motion.div>
                ))}
            </div>
        </div>
    );
};
