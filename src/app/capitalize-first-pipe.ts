import { Pipe, PipeTransform } from '@angular/core';
import { capitalizeFirst } from './text';

@Pipe({
  name: 'capitalizeFirst',
  standalone: true
})
export class CapitalizeFirstPipe implements PipeTransform {
  transform(value: string): string {
    // Handle null/undefined/empty strings
    if (!value) return value;
 
    // Capitalize first letter and append the rest
    return capitalizeFirst(value);
  }
}
