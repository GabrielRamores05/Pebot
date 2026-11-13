import { z } from 'zod';

export const AgreementLangSchema = z.enum(['en', 'fil']);

export const AcceptAgreementInputSchema = z.object({
  version: z.string().min(1).max(50),
});

export const ActivateInputSchema = z.object({
  key: z.string().min(1, 'Paste your license key').max(4000),
});

export const DeactivateInputSchema = z.object({
  confirm: z.literal(true),
});

export type AgreementLang = z.infer<typeof AgreementLangSchema>;

/** Why a key or install isn't active, in words an owner can act on. */
export const LICENSE_REASON_MESSAGES: Record<string, string> = {
  invalid: 'That license key is not valid. Copy the whole key again from our message, or import the .lic file.',
  'wrong-machine':
    'This key belongs to a different computer. Send your Machine Code to Pebot support to get the right key.',
  'wrong-version': 'This key is for a different version of Pebot. Install the version your key was made for.',
  revoked: 'This license has been cancelled. Contact Pebot support if you think this is a mistake.',
  'not-configured': 'This copy of Pebot was built without a seller key, so no license can be activated. Contact Pebot support.',
  'machine-unreadable':
    "Pebot couldn't read this computer's identity. Restart the computer and open Pebot again. If it still happens, contact Pebot support.",
  'no-agreement': 'Please read and accept the license agreement first.',
  'no-key': 'Enter the license key you received from Pebot support.',
};
