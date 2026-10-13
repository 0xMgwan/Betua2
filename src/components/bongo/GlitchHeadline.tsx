"use client";
import type { CSSProperties, ReactNode } from "react";

/**
 * The hero headline with an RGB-split glitch burst and a constant low tremor.
 *
 * Three stacked copies of the same markup rather than the usual
 * `content: attr(data-text)` trick — that flattens to one colour, and this
 * headline needs to keep its gold word.
 */
export function GlitchHeadline({
  pre, pop, post, className = "", style,
}: { pre: string; pop: string; post?: string; className?: string; style?: CSSProperties }) {
  const Inner = (): ReactNode => (
    <>
      {pre} <em className="bl-pop bl-tremor">{pop}</em>
      {post ? <> {post}</> : null}
    </>
  );

  return (
    <h1 className={`bl-glitch ${className}`} style={style}>
      <span className="bl-glitch-base"><Inner /></span>
      <span className="bl-glitch-l" aria-hidden="true"><Inner /></span>
      <span className="bl-glitch-r" aria-hidden="true"><Inner /></span>
    </h1>
  );
}
