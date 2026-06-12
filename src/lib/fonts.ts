// src/lib/fonts.ts — Matab typography (replaces Inter entirely)
//
// Wire-up in src/app/(frontend)/layout.tsx:
//
//   import { figtree, bricolage } from '@/lib/fonts'
//   <html lang="en" className={`${figtree.variable} ${bricolage.variable}`}>
//
// globals.css already maps --font-figtree / --font-bricolage to
// --font-sans / --font-display. Remove every import/reference to Inter.

import { Bricolage_Grotesque, Figtree } from 'next/font/google'

export const figtree = Figtree({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-figtree',
  display: 'swap',
})

export const bricolage = Bricolage_Grotesque({
  subsets: ['latin'],
  weight: ['600', '700'],
  variable: '--font-bricolage',
  display: 'swap',
})
