export function calculateRestaurantTax(taxableAmountPaise: number) {
  const totalPaise = Math.round(taxableAmountPaise * 0.05);
  const cgstPaise = Math.floor(totalPaise / 2);

  return {
    cgstPaise,
    sgstPaise: totalPaise - cgstPaise,
    totalPaise,
  };
}
