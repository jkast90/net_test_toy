
def clean_params(params: dict) -> dict:
    pop_keys = []
    for key in params:
        if params.get(key) is None or params.get(key) == "":
            pop_keys.append(key)
    for key in pop_keys:
        params.pop(key)
    return params
