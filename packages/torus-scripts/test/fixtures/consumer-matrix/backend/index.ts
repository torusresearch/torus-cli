function Injectable(): ClassDecorator {
  return () => undefined;
}

@Injectable()
export class BackendDependency {}

@Injectable()
export class BackendService {
  constructor(readonly dependency: BackendDependency) {}
}
