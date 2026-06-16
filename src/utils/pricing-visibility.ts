let _visible = true;

export const getPricingVisible = (): boolean => _visible;
export const setPricingVisible = (v: boolean): void => {
  _visible = v;
};
