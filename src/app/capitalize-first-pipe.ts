import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'capitalizeFirst',
  standalone: true
})
export class CapitalizeFirstPipe implements PipeTransform {
  transform(value: string): string {
    // Handle null/undefined/empty strings
    if (!value) return value;
 
    // Capitalize first letter and append the rest
    return value.charAt(0).toUpperCase() + value.slice(1);
  }
}
