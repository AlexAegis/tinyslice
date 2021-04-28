import { Observable, Subscription } from 'rxjs';
import { filter, finalize, tap } from 'rxjs/operators';
import { Action, WrappedActionPacket } from './action.class';

export interface EffectConfig {
	name?: string;
}

export const DEFAULT_EFFECT_CONFIG: EffectConfig = {
	name: 'Unnamed Effect',
};

export class Effect<T> {
	private s?: T;

	private static registered: Set<Effect<unknown>> = new Set();

	private subscription?: Subscription;
	private observable: Observable<WrappedActionPacket<T>>;

	private config: EffectConfig;

	public constructor(observable: Observable<WrappedActionPacket<T>>, config: EffectConfig = {}) {
		this.observable = observable.pipe(
			filter((wrappedAction) => Action.isRegistered(wrappedAction.type)),
			tap(({ type, payload }) => Action.emit<T>(type, payload)),
			finalize(() => Effect.registered.delete(this))
		);

		this.config = {
			...DEFAULT_EFFECT_CONFIG,
			...config,
		};
	}

	/**
	 * Keeps a subscription alive of the observable and feeds back resulting
	 * actions into the action pool
	 */
	public static from<T>(
		observable: Observable<WrappedActionPacket<T>>,
		config: EffectConfig = {}
	): Effect<T> {
		return new Effect(observable, config).register();
	}

	public register(): this {
		this.subscription = this.observable.subscribe();
		Effect.registered.add(this);
		return this;
	}

	public unregister(): void {
		this.subscription?.unsubscribe();
	}
}
