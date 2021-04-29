import { Observable, Subscription } from 'rxjs';
import { filter, finalize, tap } from 'rxjs/operators';
import { ActionPacket } from 'src/action/action-packet.interface';
import { Action } from '../action/action.class';
import { DEFAULT_EFFECT_CONFIG, EffectConfig } from './effect-config.interface';

export class Effect<T> {
	private static registered: Set<Effect<unknown>> = new Set();

	private subscription?: Subscription;
	private observable: Observable<ActionPacket<T>>;

	private config: EffectConfig;

	public constructor(observable: Observable<ActionPacket<T>>, config: EffectConfig = {}) {
		this.config = {
			...DEFAULT_EFFECT_CONFIG,
			...config,
		};

		this.observable = observable.pipe(
			filter((wrappedAction) => Action.isRegistered(wrappedAction.type)),
			tap(({ type, payload }) => Action.emit<T>(type, payload)),
			finalize(() => Effect.registered.delete(this))
		);
	}

	/**
	 * Keeps a subscription alive of the observable and feeds back resulting
	 * actions into the action pool
	 */
	public static from<T>(
		observable: Observable<ActionPacket<T>>,
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
