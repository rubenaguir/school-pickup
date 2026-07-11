import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

// Public, unauthenticated endpoint: throttled per-email (from the request
// body) rather than per-IP, per feature 007's rate limit.
interface RequestWithEmailBody {
  body?: { email?: unknown };
}

@Injectable()
export class ResendVerificationThrottlerGuard extends ThrottlerGuard {
  protected getTracker(req: RequestWithEmailBody): Promise<string> {
    const email =
      typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : 'unknown';
    return Promise.resolve(`resend-verification:${email}`);
  }

  protected throwThrottlingException(): Promise<void> {
    throw new HttpException(
      {
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Too many verification emails requested for this address.',
      },
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }
}
